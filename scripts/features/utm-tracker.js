// scripts/utm-tracker.js
// UTM Parameter Tracking & Attribution
// Captures UTM parameters from URL and stores in localStorage for later use

(function(window) {
  'use strict';

  const UTMTracker = {
    STORAGE_KEY: 'clarity_utm_data',
    EXPIRY_DAYS: 30,

    // Parse URL parameters
    getUrlParams() {
      const params = new URLSearchParams(window.location.search);
      return {
        utm_source: params.get('utm_source') || '',
        utm_medium: params.get('utm_medium') || '',
        utm_campaign: params.get('utm_campaign') || '',
        utm_content: params.get('utm_content') || '',
        utm_term: params.get('utm_term') || '',
        referrer: document.referrer || '',
        landing_page: window.location.href,
        timestamp: new Date().toISOString()
      };
    },

    // Get device type
    getDeviceType() {
      const width = window.innerWidth;
      if (width < 768) return 'mobile';
      if (width < 1024) return 'tablet';
      return 'desktop';
    },

    // Store UTM data in localStorage
    storeUTMData(utmData) {
      try {
        const data = {
          ...utmData,
          device: this.getDeviceType(),
          expires_at: new Date(Date.now() + (this.EXPIRY_DAYS * 24 * 60 * 60 * 1000)).toISOString()
        };
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        console.log('✅ UTM data stored:', data);
      } catch (err) {
        console.error('❌ Failed to store UTM data:', err);
      }
    },

    // Retrieve stored UTM data
    getStoredUTMData() {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (!stored) return null;

        const data = JSON.parse(stored);
        
        // Check if expired
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          this.clearUTMData();
          return null;
        }

        return data;
      } catch (err) {
        console.error('❌ Failed to retrieve UTM data:', err);
        return null;
      }
    },

    // Clear stored UTM data
    clearUTMData() {
      localStorage.removeItem(this.STORAGE_KEY);
    },

    // Check if there are UTM parameters in current URL
    hasUTMParams() {
      const params = new URLSearchParams(window.location.search);
      return params.has('utm_source') || 
             params.has('utm_medium') || 
             params.has('utm_campaign');
    },

    // Initialize tracking
    init() {
      console.log('🔍 UTM Tracker initializing...');

      // If URL has UTM parameters, capture them
      if (this.hasUTMParams()) {
        const utmData = this.getUrlParams();
        this.storeUTMData(utmData);
        console.log('📊 New UTM parameters captured');
      } else {
        // Check if we have stored UTM data
        const stored = this.getStoredUTMData();
        if (stored) {
          console.log('📦 Using stored UTM data:', stored);
        } else {
          console.log('ℹ️ No UTM parameters found');
        }
      }
    },

    // Get attribution data for lead creation
    getAttributionData() {
      const stored = this.getStoredUTMData();
      
      if (!stored) {
        return {
          source: 'direct',
          campaign: null,
          utm_params: {},
          first_touch: true
        };
      }

      return {
        source: stored.utm_source || 'unknown',
        campaign: stored.utm_campaign || null,
        utm_params: {
          utm_source: stored.utm_source,
          utm_medium: stored.utm_medium,
          utm_campaign: stored.utm_campaign,
          utm_content: stored.utm_content,
          utm_term: stored.utm_term
        },
        landing_page: stored.landing_page,
        referrer: stored.referrer,
        device: stored.device,
        first_touch: true // Will be determined by backend
      };
    },

    // Record a touchpoint (can be called multiple times)
    recordTouchpoint(leadId) {
      const attribution = this.getAttributionData();
      
      // This will be called when lead interacts with page
      // Backend will handle creating touchpoint record
      return {
        lead_id: leadId,
        ...attribution,
        touchpoint_date: new Date().toISOString()
      };
    }
  };

  // Auto-initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      UTMTracker.init();
    });
  } else {
    UTMTracker.init();
  }

  // Expose globally
  window.UTMTracker = UTMTracker;

})(window);
