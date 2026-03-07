# CLARITY - Product Vision & Roadmap

## 🎯 Mission Statement

**The Ultimate Operating System for High-Ticket Coaches & Agencies**

Clarity eliminates blind spots, automates bottleneck detection, and provides AI-powered solutions to scale high-ticket businesses with 100% accuracy.

---

## 👥 Target Market

**Primary:** High-Ticket Coaches & Agencies ($2,000+ products)
- Selling via Phone/Zoom
- Funnel-driven lead generation (Facebook/Google Ads → VSL → Calls)
- 2-Call Close or 1-Call Close models
- Setting + Closing Teams

**NOT for:**
- E-Commerce
- Low-Ticket Coaches
- B2B SaaS (yet)

---

## 🔥 Core Value Proposition

### What Clarity Does (Final Vision)

1. **100% Accurate Tracking** - Every traffic source, every funnel, every call
2. **AI Bottleneck Detection** - Trained by industry experts to find levers
3. **Prioritized Solutions** - Attack biggest bottlenecks first
4. **Live Projections** - Month/Year forecasts down to profit, updated real-time
5. **Team KPI Tracking** - Keep every team on track to hit projections

### What Clarity Knows

- All traffic sources (Ads, Organic, Cold Outreach)
- Ad copies & creative performance
- Funnel pages & VSL performance
- Email/SMS follow-up sequences
- **Transcripts of every Setting Call**
- **Transcripts of every Sales Call**

### What Clarity Does With It

**Optimization:**
- Create high-converting ad copies based on sales call insights
- Generate funnel/VSL split-test variations
- Optimize setter scripts + identify off-script moments
- Optimize closer scripts + track deviations

**Visibility:**
- Biggest levers to accelerate growth
- Most impactful bottlenecks + how to solve
- No blind spots in the business
- Setter/Closer performance gaps (exact location in script)
- Profit projections: End-of-month goal vs. current trajectory
- Daily profit tracking: "Where are we today?"

### Ultimate Benefits

- **More Resourceful** - Focus on right things at right time
- **Cost Savings** - Fewer team members needed
- **Data-Driven Decisions** - 100% realistic KPIs
- **Competitive Advantage** - Scale while others struggle
- **Clarity** = Profit

---

## 📐 Product Architecture (4 Main Tabs)

### 1. **Datenpool** (Data Lake)
**Status:** ✅ MVP Complete (Session 6)

**Purpose:** Central data repository for all downstream features

**Data Sources:**
- Facebook Ads (✅ live)
- Google Ads (🔜 planned)
- Cold Calls/Emails (🔜 planned)
- Organic traffic (🔜 planned)
- Lead data (name, email, phone, events)
- Conversion events (Lead → Survey → Setting → Closing → Unit)
- Revenue & Cash data

**Features:**
- CSV Import (✅ live)
- Event tracking across funnels (✅ live)
- Traffic source tabs (✅ live)
- Campaign-level insights (✅ live)
- Export & bulk actions (✅ live)

---

### 2. **Tracking Sheets** (Funnel Tracking)
**Status:** ✅ MVP Complete (Session 1-5)

**Purpose:** Daily tracking for all funnels with KPI calculations

**Features:**
- Multi-funnel system (✅ live)
- Modular funnel builder (✅ live)
- Month View (daily tracking) (✅ live)
- Year View (monthly aggregations) (✅ live)
- Supabase cloud storage (✅ live)
- Facebook Ads auto-sync (✅ live, daily at 3 AM)
- KPI auto-calculations (✅ live)
- CSV import (✅ live)

**Current Modules:**
- Traffic: Paid Ads, Organic, Cold Calls, Cold Emails
- Funnel: Classic VSL, Direct VSL, Direct Call Booking
- Survey: Qualified, Unqualified, No Survey
- Close: 1-Call, 2-Call
- Revenue: Paid, Organic

---

### 3. **Projections** (Forecasting & Goal Setting)
**Status:** 🚧 **MVP Priority - Not Started**

**Purpose:** Data-driven forecasts, goal setting, and bottleneck detection

#### 3.1 Money In/Out Calculator
- **Money IN:**
  - Front-End Funnels (Ad Spend → Leads → Calls → Units → Cash)
  - Back-End Sales (Retainers, Renewals, Upsells)
  
- **Money OUT:**
  - Ad Spend
  - Team Costs (Setters, Closers, Ads Manager, etc.)
  - Software Costs
  - Other OpEx

- **Output:**
  - Monthly Revenue Target
  - Monthly Profit Target
  - Required KPIs to hit target (based on historical averages)

#### 3.2 Daily KPI Breakdown
- **Global Goal** (e.g., €100k profit this month)
- **Weekly Breakdown** (€25k per week)
- **Daily Breakdown** (€3,571 per day)
- **Team KPIs:**
  - Setters: X bookings/day @ Y% show-up rate
  - Closers: Z calls/day @ W% close rate
  - Media Buyer: €X spend @ Y ROAS

#### 3.3 Live Progress Tracking
- **Real-Time Dashboard:**
  - Current day progress vs. target
  - MTD (Month-to-Date) vs. target
  - Projected EOM (End-of-Month) based on current pace

#### 3.4 Bottleneck Detection
- **Automatic Flagging:**
  - "Setting Call → Closing Call conversion is 7% below target"
  - "Cash Collection Rate is 10% below target = €X less profit"
  - "Facebook Ads CPL increased 15% this week"

- **Prioritized Action Items:**
  - Rank bottlenecks by profit impact
  - AI-trained suggestions (no done-for-you yet)
  - Example: "1️⃣ Check which setter is pulling average down → 2️⃣ Identify script deviations → 3️⃣ QC session needed"

#### 3.5 Scenario Planning
- **"What-If" Simulator:**
  - "What if we increase ad spend by 30%?"
  - "What if sales team improves close rate by 3%?"
  - "What if we add 2 more setters?"
  - Shows projected profit impact

#### 3.6 Historical Baseline
- Uses last 4-8 weeks of data for realistic averages
- Adjusts for seasonality
- Flags anomalies

**Key Differentiator:** No generic advice - Everything trained by YOU as industry expert for High-Ticket space.

---

### 4. **Scale It** (AI-Powered Automation)
**Status:** 🔮 **Post-MVP - Future Vision**

**Purpose:** AI does the optimization work FOR you

**Required Integrations:**
- Ad platform API access (Facebook/Google)
- Funnel page content scraping (GHL, ClickFunnels, etc.)
- Call recording system (Gong, Fireflies, custom)
- Transcript generation (Whisper AI or similar)
- CRM integration (GHL, HubSpot)

#### 4.1 Ad Copy Generator
**Input:**
- Current winning ads
- Sales call transcripts (objections, pain points)
- Best-performing campaigns

**Output:**
- 3-5 new ad variations
- A/B test recommendations
- Predicted performance

#### 4.2 Funnel Optimizer
**Input:**
- Current funnel page copy
- Conversion rate data
- User session recordings (optional)

**Output:**
- Headline split-tests
- VSL script improvements
- CTA variations

#### 4.3 Setter Performance Coach
**Input:**
- All setter call transcripts
- Script template
- Conversion rates per setter

**Output:**
- Identifies which setter deviates where
- Shows exact script deviation moments
- Personalized coaching recommendations

#### 4.4 Closer Performance Coach
**Input:**
- All closer call transcripts
- Script template
- Close rates per closer
- Objection patterns

**Output:**
- Identifies which closer struggles where
- Shows exact script deviation moments
- Objection-handling improvements
- Personalized coaching recommendations

**Key Differentiator:** AI trained on YOUR best-performing assets and YOUR expert methodology.

---

## 🛤️ Product Roadmap

### **Current Status: MVP Foundation (40% Complete)**

**What's Live:**
- ✅ Tracking Sheets (Month + Year View)
- ✅ Modular Funnel Builder
- ✅ Supabase Cloud Storage
- ✅ Datenpool (Basic Events + Traffic)
- ✅ Facebook Ads Integration (Auto-Sync)
- ✅ CSV Import (Manual fallback)

**What's Missing for MVP:**
- ❌ **Automatic Conversion Tracking** 🎯 **Critical**
- ❌ **Call Tracking Automation** 🎯 **Critical**
- ❌ **Sales/Revenue Automation** 🎯 **Critical**
- ❌ Projections Tab (depends on complete data)
- ❌ Google Ads Integration (nice-to-have)

**Why MVP is NOT 95% done:**
Current state requires **manual CSV imports** for most data. The vision is **100% automation**. Until Datenpool automatically captures Leads → Calls → Sales → Revenue, the product cannot fulfill its core promise of "100% accuracy with zero manual work."

---

### **Phase 1: Datenpool Automation (Q1 2026)** - 🚧 **IN PROGRESS**

#### 1.1 Traffic Sources ✅ Partially Done
- [x] Facebook Ads Integration (live)
- [ ] Google Ads Integration
- [ ] Organic Traffic Attribution
- [ ] Cold Call/Email Tracking

#### 1.2 Lead Generation Automation 🎯 **PRIORITY**
- [ ] **Calendly Integration**
  - Webhook: New booking → Create `lead` + `settingBooking` event
  - Track: Booking time, attendee info, funnel source
  
- [ ] **Typeform Integration**
  - Webhook: Form submission → Create `survey` event
  - Track: Answers, qualification status, funnel source
  
- [ ] **ClickFunnels/GoHighLevel Integration**
  - Webhook: Form submission → Create `lead` event
  - Track: Opt-in data, funnel page, UTM params

#### 1.3 Call Tracking Automation 🎯 **PRIORITY**
- [ ] **Setting Call Tracking**
  - Input: Calendly booking + CRM data
  - Track: Booked vs. Showed up (show-up rate)
  - Event: `settingTermin` (scheduled) + `settingCall` (completed)
  
- [ ] **Closing Call Tracking**
  - Input: Calendar system + CRM data
  - Track: Booked vs. Showed up (show-up rate)
  - Event: `closingTermin` (scheduled) + `closingCall` (completed)

#### 1.4 Sales/Revenue Automation 🎯 **PRIORITY**
- [ ] **Units Sold Tracking**
  - Input: CRM deal close event or payment webhook
  - Track: # units, timestamp, closer name
  - Event: `unit` with revenue/cash data
  
- [ ] **Revenue Tracking**
  - Input: Stripe/PayPal webhook or CRM
  - Track: Product price, payment plan
  - Store: `revenue` field on `unit` event
  
- [ ] **Cash Collection Tracking**
  - Input: Stripe/PayPal webhook (successful charge)
  - Track: Actual collected amount vs. revenue
  - Store: `cash` field on `unit` event
  - Update: Cash Collection Rate metric

#### 1.5 CRM Integration Strategy
**Options:**
- **GoHighLevel** (most common in High-Ticket space)
- **HubSpot** (enterprise coaches)
- **Custom Webhooks** (flexibility for any system)

**Approach:**
1. Start with **Webhooks** (tool-agnostic)
2. Build GoHighLevel native integration (if most users need it)
3. Expand to other CRMs based on demand

---

### **Phase 2: MVP Completion (Q2 2026)** - After Datenpool Automation

#### 2.1 Automatic Tracking Sheet Population
- [ ] Map Datenpool events → Tracking Sheet fields
- [ ] Auto-fill daily values from events
- [ ] Sync frequency: Real-time or hourly batch
- [ ] Conflict resolution (manual edits vs. auto-sync)

#### 2.2 Projections Tab (Initial Version)
- [ ] Money In/Out calculator UI
- [ ] Goal setting form (monthly targets)
- [ ] KPI breakdown logic (daily/weekly)
- [ ] Historical baseline calculation (4-8 weeks)
- [ ] Live progress dashboard
- [ ] Bottleneck detection algorithm
- [ ] Manual action suggestions (AI-trained prompts)

#### 2.3 Dashboard View
- [ ] All funnels overview
- [ ] Key metrics at-a-glance
- [ ] Quick filters (date range, funnel, source)
- [ ] Export/PDF reports

---

### **Phase 3: Advanced Features (Q3 2026)**

#### 3.1 Call Intelligence Foundation
- [ ] Call Recording Integration (Gong/Fireflies/Custom)
- [ ] Transcript Storage (Datenpool)
- [ ] Link transcripts to events (`settingCall`, `closingCall`)

#### 3.2 Performance Tracking
- [ ] Setter Performance Dashboard
  - Show-up rate, booking rate, conversion to closing
  - Compare to team average
  
- [ ] Closer Performance Dashboard
  - Close rate, avg deal size, objection patterns
  - Compare to team average

#### 3.3 Script Deviation Detection (Manual Analysis)
- [ ] Upload setter/closer scripts
- [ ] Manual transcript review tools
- [ ] Flag key moments (objection, deviation, win)

---

### **Phase 4: AI Automation - "Scale It" (Q4 2026+)**

#### 4.1 AI-Powered Optimization
- [ ] Ad Copy Generator (based on winning ads + call insights)
- [ ] Funnel Optimizer (split-test suggestions)
- [ ] Setter Coach (script deviations, personalized feedback)
- [ ] Closer Coach (objection handling, script improvements)

#### 4.2 Training Data Requirements
- [ ] Minimum 1,000 call transcripts
- [ ] Minimum 100 winning ad campaigns
- [ ] Minimum 50 funnel variations tested
- [ ] Expert methodology documentation (your input)

---

## 📊 Revised MVP Definition

**MVP = 100% Automated Data Collection**

The product is **NOT** MVP-ready until:
1. ✅ All lead sources auto-sync (Calendly, Typeform, ClickFunnels, etc.)
2. ✅ All call events auto-track (Setting + Closing bookings & completions)
3. ✅ All sales/revenue auto-sync (Units, Revenue, Cash Collection)
4. ✅ Tracking Sheets auto-populate from Datenpool
5. ✅ Projections Tab shows live forecasts

**Current Status:** 40% complete (Traffic automation done, Conversion automation missing)

**ETA for True MVP:** 8-12 weeks (depending on integration complexity)

---

## 🚀 Immediate Next Steps

### Week 1-2: Integration Planning
- [ ] Identify exact tools used by target customers
- [ ] Research API documentation (Calendly, Typeform, etc.)
- [ ] Design webhook receiver architecture
- [ ] Map events to Datenpool schema

### Week 3-4: Lead-Gen Automation
- [ ] Build Calendly integration (setting bookings)
- [ ] Build Typeform integration (survey data)
- [ ] Build ClickFunnels/GHL webhook receiver
- [ ] Test end-to-end: Ad → Lead → Survey → Booking

### Week 5-6: Call Tracking Automation
- [ ] Build setting call tracking (booked vs. showed)
- [ ] Build closing call tracking (booked vs. showed)
- [ ] Calculate show-up rates automatically
- [ ] Link calls to leads (deduplication)

### Week 7-8: Sales/Revenue Automation
- [ ] Build payment webhook receiver (Stripe/PayPal)
- [ ] Track units sold + revenue + cash
- [ ] Auto-update Cash Collection Rate
- [ ] Test full funnel: Ad → Lead → Call → Sale → Cash

### Week 9-10: Tracking Sheet Auto-Population
- [ ] Build event → Tracking Sheet sync logic
- [ ] Handle multiple funnels simultaneously
- [ ] Conflict resolution (manual vs. auto)
- [ ] Real-time or batch sync decision

### Week 11-12: Projections Tab (Initial)
- [ ] Build goal-setting UI
- [ ] Calculate required KPIs from historical data
- [ ] Live progress dashboard
- [ ] Basic bottleneck detection

---

## 📊 Success Metrics (Revised)

### MVP Success (After Automation Complete)
- **Data Accuracy:** 95%+ auto-captured (5% manual edge cases)
- **User Effort:** <10 minutes/day of manual input
- **Beta Users:** 10-20 High-Ticket coaches testing
- **Feedback:** 80%+ say "This saves me hours per week"

### Product-Market Fit (6 months post-MVP)
- 100+ active users
- $10k+ MRR
- 90%+ retention month-over-month
- 5+ customer testimonials with measurable results
- Average user profit increase: 15-30%

### Scale Readiness (12 months)
- 500+ active users
- $50k+ MRR
- AI features in beta (Scale It tab)
- Call transcript analysis live
- Churn <5%/month
- Industry recognition (podcast features, case studies)

---

## 🎨 Design Philosophy

### Current State
- Vanilla JavaScript (no frameworks)
- Functional, not polished
- Inline styles (needs refactor)

### Target State
- **Design System:**
  - CSS Custom Properties (colors, spacing, typography)
  - Reusable component library
  - Consistent button/modal/table styles
  
- **User Experience:**
  - Clean, professional interface
  - Minimal cognitive load
  - Fast, responsive interactions
  
- **Mobile Support:**
  - Not priority (desktop-first for power users)
  - Responsive layout for tablets

### Design Timing
- **Now:** Define CSS variables, unify buttons/modals
- **Later:** Full redesign when features stabilize

---

## 💡 Key Insights

### Why Clarity Wins

1. **Vertical Focus:** Built FOR High-Ticket, not generic SaaS
2. **Expert-Trained AI:** Your methodology, not generic advice
3. **End-to-End:** Tracking → Projections → Optimization
4. **Call Intelligence:** Transcripts unlock massive value
5. **No Blind Spots:** 100% accuracy claim is bold but defensible

### Competitive Moats

- Deep High-Ticket expertise (you as founder)
- Call transcript integration (hard to replicate)
- AI trained on winning campaigns (data advantage)
- All-in-one platform (no Frankenstein tool stack)

### Risks to Mitigate

- Call recording privacy/compliance (GDPR, consent)
- AI accuracy (bad suggestions hurt credibility)
- Pricing model (High-Ticket coaches = price-sensitive?)
- Onboarding complexity (needs hand-holding?)

---

## 🚀 Next Steps (Immediate)

### 1. Complete MVP
**Focus:** Projections Tab (3-4 weeks)

**Tasks:**
- [ ] Money In/Out calculator UI
- [ ] Goal setting form (monthly targets)
- [ ] KPI breakdown logic (daily/weekly)
- [ ] Historical baseline calculation
- [ ] Live progress dashboard
- [ ] Bottleneck detection algorithm
- [ ] AI prompt framework (manual suggestions first)

### 2. Polish Core UX
**Focus:** Design consistency (1 week)

**Tasks:**
- [ ] Create CSS variables file
- [ ] Standardize buttons (primary, secondary, danger)
- [ ] Unify modal styles
- [ ] Consistent table styling
- [ ] Loading states & animations

### 3. Beta Testing
**Focus:** Real user feedback (2 weeks)

**Tasks:**
- [ ] Recruit 5-10 High-Ticket coaches
- [ ] Guided onboarding sessions
- [ ] Collect pain points & feature requests
- [ ] Iterate on MVP

### 4. Launch Prep
**Focus:** Go-to-market (2 weeks)

**Tasks:**
- [ ] Landing page
- [ ] Demo video
- [ ] Pricing tiers
- [ ] Support documentation
- [ ] Payment integration

---

## 📊 Success Metrics

### MVP Success (3 months)
- 50+ active users
- 80%+ retention month-over-month
- NPS score >40
- 10+ feature requests from power users

### Product-Market Fit (6 months)
- 200+ active users
- $10k+ MRR
- 5+ customer testimonials with results
- 1-2 case studies (X% profit increase)

### Scale Readiness (12 months)
- 500+ active users
- $50k+ MRR
- AI features in beta
- Call tracking live
- Churn <5%/month

---

## 🔐 Confidential Notes

- This is NOT a generic analytics tool
- This is NOT for low-ticket businesses
- This IS the unfair advantage for High-Ticket operators
- The AI training on YOUR methodology is the secret sauce
- Call transcripts = gold mine (objections, pain points, winning lines)

---

**Last Updated:** February 17, 2026  
**Current Phase:** MVP - Projections Tab Development  
**Status:** 40% Complete, Ready for Next Phase
