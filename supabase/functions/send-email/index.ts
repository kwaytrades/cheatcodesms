import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, htmlBody, textBody, fromEmail, fromName, replyTo }: EmailRequest = await req.json();

    console.log(`Sending email to: ${to}, subject: ${subject}`);

    // Validate required fields
    if (!to || !subject || (!htmlBody && !textBody)) {
      throw new Error("Missing required fields: to, subject, and at least one of htmlBody or textBody");
    }

    // Get AWS credentials from environment
    const awsAccessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
    const awsSecretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
    const awsRegion = Deno.env.get("AWS_REGION") || "us-east-1";

    if (!awsAccessKeyId || !awsSecretAccessKey) {
      throw new Error("AWS credentials not configured");
    }

    // Prepare the email data for AWS SES API
    const source = fromName 
      ? `${fromName} <${fromEmail || "noreply@yourdomain.com"}>`
      : fromEmail || "noreply@yourdomain.com";

    const emailData: any = {
      Source: source,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: "UTF-8",
        },
        Body: {},
      },
    };

    if (htmlBody) {
      emailData.Message.Body.Html = {
        Data: htmlBody,
        Charset: "UTF-8",
      };
    }

    if (textBody) {
      emailData.Message.Body.Text = {
        Data: textBody,
        Charset: "UTF-8",
      };
    }

    if (replyTo) {
      emailData.ReplyToAddresses = [replyTo];
    }

    // Make direct API call to AWS SES
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = timestamp.slice(0, 8);
    
    const url = `https://email.${awsRegion}.amazonaws.com/`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Amz-Date': timestamp,
        'Authorization': `AWS4-HMAC-SHA256 Credential=${awsAccessKeyId}/${date}/${awsRegion}/ses/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=UNSIGNED-PAYLOAD`,
      },
      body: new URLSearchParams({
        'Action': 'SendEmail',
        'Source': source,
        'Destination.ToAddresses.member.1': to,
        'Message.Subject.Data': subject,
        'Message.Subject.Charset': 'UTF-8',
        ...(htmlBody ? {
          'Message.Body.Html.Data': htmlBody,
          'Message.Body.Html.Charset': 'UTF-8',
        } : {}),
        ...(textBody ? {
          'Message.Body.Text.Data': textBody,
          'Message.Body.Text.Charset': 'UTF-8',
        } : {}),
      }).toString(),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error("AWS SES error:", responseText);
      throw new Error(`Failed to send email: ${response.status} ${responseText}`);
    }

    // Extract MessageId from XML response
    const messageIdMatch = responseText.match(/<MessageId>(.*?)<\/MessageId>/);
    const messageId = messageIdMatch ? messageIdMatch[1] : "unknown";

    console.log("Email sent successfully:", messageId);

    return new Response(
      JSON.stringify({
        success: true,
        messageId,
        message: "Email sent successfully"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to send email",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
};

serve(handler);
