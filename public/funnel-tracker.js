/**
 * Universal Funnel Tracker
 * Auto-detects funnel steps and tracks visitor journey across multiple projects
 */
(function(window) {
  'use strict';

  const FunnelTracker = {
    config: {
      apiEndpoint: null,
      debug: false
    },
    
    sessionId: null,
    funnelId: null,
    stepId: null,
    currentStep: null,
    initialized: false,
    startTime: Date.now(),
    
    /**
     * Initialize the tracker
     */
    init: function(options) {
      if (this.initialized) return;
      
      this.config = { ...this.config, ...options };
      this.sessionId = this.getOrCreateSessionId();
      this.detectFunnelStep();
      this.initialized = true;
      
      this.log('Tracker initialized', { sessionId: this.sessionId });
    },
    
    /**
     * Get or create session ID
     */
    getOrCreateSessionId: function() {
      // Check URL parameter first (for cross-domain tracking)
      const urlParams = new URLSearchParams(window.location.search);
      const urlSessionId = urlParams.get('session_id');
      if (urlSessionId) {
        localStorage.setItem('funnel_session_id', urlSessionId);
        return urlSessionId;
      }
      
      // Check localStorage
      let sessionId = localStorage.getItem('funnel_session_id');
      if (!sessionId) {
        sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(7);
        localStorage.setItem('funnel_session_id', sessionId);
      }
      
      return sessionId;
    },
    
    /**
     * Detect which funnel/step based on URL
     */
    detectFunnelStep: async function() {
      const urlParams = new URLSearchParams(window.location.search);
      const urlFunnelId = urlParams.get('funnel_id');
      const urlStepId = urlParams.get('step_id');
      
      // If both provided in URL, use them
      if (urlFunnelId && urlStepId) {
        this.funnelId = urlFunnelId;
        this.stepId = urlStepId;
        this.trackPageView();
        return;
      }
      
      // Otherwise, lookup by URL
      try {
        const response = await fetch(`${this.config.apiEndpoint}/get-funnel-step`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            pageUrl: window.location.href,
            domain: window.location.hostname,
            path: window.location.pathname
          })
        });
        
        const data = await response.json();
        
        if (data.funnel_id && data.step_id) {
          this.funnelId = data.funnel_id;
          this.stepId = data.step_id;
          this.currentStep = data.step_name;
          this.log('Funnel step detected', data);
          this.trackPageView();
        } else {
          this.log('No matching funnel step found for this URL');
          this.trackUnknownVisit();
        }
      } catch (error) {
        this.log('Error detecting funnel step', error);
        this.trackUnknownVisit();
      }
    },
    
    /**
     * Track page view
     */
    trackPageView: function() {
      if (!this.funnelId || !this.stepId) return;
      
      const eventData = {
        session_id: this.sessionId,
        funnel_id: this.funnelId,
        step_id: this.stepId,
        event_type: 'page_view',
        metadata: this.collectMetadata()
      };
      
      this.sendEvent(eventData);
      
      // Track time on page
      this.trackTimeOnPage();
      
      // Track scroll depth
      this.trackScrollDepth();
      
      // Track exit intent
      this.trackExitIntent();
    },
    
    /**
     * Track unknown visit (no matching funnel)
     */
    trackUnknownVisit: function() {
      const eventData = {
        session_id: this.sessionId,
        page_url: window.location.href,
        metadata: this.collectMetadata()
      };
      
      // Store locally for now
      this.log('Unknown visit tracked', eventData);
    },
    
    /**
     * Send event to backend
     */
    sendEvent: async function(eventData) {
      try {
        const response = await fetch(`${this.config.apiEndpoint}/track-funnel-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData)
        });
        
        const result = await response.json();
        this.log('Event tracked', result);
        return result;
      } catch (error) {
        this.log('Error tracking event', error);
      }
    },
    
    /**
     * Collect metadata about visitor and session
     */
    collectMetadata: function() {
      const urlParams = new URLSearchParams(window.location.search);
      
      return {
        url: window.location.href,
        referrer: document.referrer || null,
        utm_source: urlParams.get('utm_source') || null,
        utm_medium: urlParams.get('utm_medium') || null,
        utm_campaign: urlParams.get('utm_campaign') || null,
        utm_term: urlParams.get('utm_term') || null,
        utm_content: urlParams.get('utm_content') || null,
        device_type: this.getDeviceType(),
        browser: this.getBrowser(),
        screen_width: window.screen.width,
        screen_height: window.screen.height,
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
        user_agent: navigator.userAgent,
        language: navigator.language,
        timestamp: new Date().toISOString()
      };
    },
    
    /**
     * Get device type
     */
    getDeviceType: function() {
      const ua = navigator.userAgent;
      if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        return 'tablet';
      }
      if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
        return 'mobile';
      }
      return 'desktop';
    },
    
    /**
     * Get browser name
     */
    getBrowser: function() {
      const ua = navigator.userAgent;
      if (ua.indexOf('Chrome') > -1) return 'Chrome';
      if (ua.indexOf('Safari') > -1) return 'Safari';
      if (ua.indexOf('Firefox') > -1) return 'Firefox';
      if (ua.indexOf('Edge') > -1) return 'Edge';
      return 'Other';
    },
    
    /**
     * Track time on page
     */
    trackTimeOnPage: function() {
      window.addEventListener('beforeunload', () => {
        const duration = Math.floor((Date.now() - this.startTime) / 1000);
        
        if (this.funnelId && this.stepId) {
          navigator.sendBeacon(
            `${this.config.apiEndpoint}/track-funnel-event`,
            JSON.stringify({
              session_id: this.sessionId,
              funnel_id: this.funnelId,
              step_id: this.stepId,
              event_type: 'time_on_page',
              metadata: { duration_seconds: duration }
            })
          );
        }
      });
    },
    
    /**
     * Track scroll depth
     */
    trackScrollDepth: function() {
      let maxScroll = 0;
      let scrollTracked = {
        '25': false,
        '50': false,
        '75': false,
        '100': false
      };
      
      window.addEventListener('scroll', () => {
        const scrollPercent = Math.floor(
          (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
        );
        
        if (scrollPercent > maxScroll) {
          maxScroll = scrollPercent;
          
          ['25', '50', '75', '100'].forEach(threshold => {
            if (scrollPercent >= parseInt(threshold) && !scrollTracked[threshold]) {
              scrollTracked[threshold] = true;
              
              if (this.funnelId && this.stepId) {
                this.sendEvent({
                  session_id: this.sessionId,
                  funnel_id: this.funnelId,
                  step_id: this.stepId,
                  event_type: 'scroll_depth',
                  metadata: { scroll_percent: threshold }
                });
              }
            }
          });
        }
      });
    },
    
    /**
     * Track exit intent
     */
    trackExitIntent: function() {
      let exitTracked = false;
      
      document.addEventListener('mouseleave', (e) => {
        if (e.clientY < 0 && !exitTracked) {
          exitTracked = true;
          
          if (this.funnelId && this.stepId) {
            this.sendEvent({
              session_id: this.sessionId,
              funnel_id: this.funnelId,
              step_id: this.stepId,
              event_type: 'exit_intent',
              metadata: { triggered: true }
            });
          }
        }
      });
    },
    
    /**
     * Identify visitor
     */
    identify: async function(data) {
      if (!data.email && !data.phone) {
        this.log('Email or phone required for identification');
        return;
      }
      
      try {
        const response = await fetch(`${this.config.apiEndpoint}/identify-funnel-visitor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: this.sessionId,
            funnel_id: this.funnelId,
            email: data.email || null,
            phone: data.phone || null,
            name: data.name || null
          })
        });
        
        const result = await response.json();
        this.log('Visitor identified', result);
        return result;
      } catch (error) {
        this.log('Error identifying visitor', error);
      }
    },
    
    /**
     * Track conversion
     */
    conversion: async function(data) {
      if (!this.funnelId) {
        this.log('No funnel detected for conversion tracking');
        return;
      }
      
      try {
        const response = await fetch(`${this.config.apiEndpoint}/track-funnel-conversion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: this.sessionId,
            funnel_id: this.funnelId,
            contact_id: data.contact_id || null,
            order_value: data.orderValue || 0,
            product_id: data.productId || null,
            conversion_type: data.conversionType || 'purchase',
            metadata: data.metadata || {}
          })
        });
        
        const result = await response.json();
        this.log('Conversion tracked', result);
        return result;
      } catch (error) {
        this.log('Error tracking conversion', error);
      }
    },
    
    /**
     * Track custom event
     */
    track: function(eventName, properties) {
      if (!this.funnelId || !this.stepId) return;
      
      this.sendEvent({
        session_id: this.sessionId,
        funnel_id: this.funnelId,
        step_id: this.stepId,
        event_type: eventName,
        metadata: properties || {}
      });
    },
    
    /**
     * Add session ID to URL for cross-domain tracking
     */
    addSessionToUrl: function(url) {
      const urlObj = new URL(url);
      urlObj.searchParams.set('session_id', this.sessionId);
      if (this.funnelId) {
        urlObj.searchParams.set('funnel_id', this.funnelId);
      }
      return urlObj.toString();
    },
    
    /**
     * Debug logging
     */
    log: function(message, data) {
      if (this.config.debug) {
        console.log('[FunnelTracker]', message, data || '');
      }
    }
  };
  
  // Expose to window
  window.FunnelTracker = FunnelTracker;
  
})(window);

