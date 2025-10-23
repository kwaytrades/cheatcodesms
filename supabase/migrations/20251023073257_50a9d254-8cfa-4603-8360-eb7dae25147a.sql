-- Add DELETE policies for related tables to allow contact deletion

-- Allow authenticated users to delete contact activities
CREATE POLICY "Authenticated users can delete contact activities"
ON contact_activities
FOR DELETE
TO authenticated
USING (true);

-- Allow authenticated users to delete AI messages
CREATE POLICY "Authenticated users can delete ai_messages"
ON ai_messages
FOR DELETE
TO public
USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete purchases
CREATE POLICY "Authenticated users can delete purchases"
ON purchases
FOR DELETE
TO public
USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete any notifications (for contact cleanup)
CREATE POLICY "Authenticated users can delete notifications"
ON notifications
FOR DELETE
TO public
USING (auth.role() = 'authenticated');