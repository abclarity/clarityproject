Clarity Funnel Tracker – AI Agent Instructions (Extended)

👤 Developer Context

I am a programming beginner.
I build this project using VS Code + AI assistance (Copilot / ChatGPT).

I do not want quick hacks.
I do not want messy patches.
I want to build this software cleanly, modular, and scalable from the ground up.

If a solution requires deeper structural changes, I want:
	•	A clear explanation
	•	Step-by-step guidance
	•	The reasoning behind it
	•	Best practice suggestions
	•	Warnings about side effects

If something is unclear or potentially problematic:
👉 The AI should ask clarifying questions.
👉 The AI may suggest better architecture or improvements.
👉 The AI should challenge bad ideas politely.

This project should grow into a professional-grade application, not a prototype spaghetti app.

⸻

🏗 Project Overview

Clarity is a vanilla JavaScript funnel tracking SPA for marketing analytics.
	•	No frameworks
	•	No build tools
	•	Pure HTML/CSS/JS
	•	localStorage persistence
	•	Optional Supabase backend for pooled event tracking

⸻

🧱 Core Architecture Principles

1️⃣ No Hacks. No Duplicates. No Hidden Magic.
	•	No duplicate logic
	•	No redundant CSS blocks
	•	No copy-paste patches
	•	No silent side effects
	•	No random global variables

Everything must have:
	•	A clear responsibility
	•	A clean separation of concerns
	•	A predictable data flow

⸻

2️⃣ Multi-Funnel System

Each funnel:
	•	Has its own dataset
	•	Uses modular configuration
	•	Is isolated from other funnels

Storage pattern:vsl_{funnelId}_{year}_{month}Active funnel stored in:vsl_active_funnelData must never leak between funnels.

⸻

3️⃣ Modular Funnel Builder

Defined in scripts/modules.js.

Modules:
	•	Traffic
	•	Funnel
	•	Survey
	•	Close
	•	Revenue

Each module must define:
	•	columns
	•	inputs
	•	inputKeys
	•	provides

Data flows downstream.
Module order matters.

If adding new modules:
	•	Must not break existing funnels
	•	Must follow same structure
	•	Must not introduce conditional chaos

⸻

4️⃣ Clean View Separation

Main Views:
	•	Month View
	•	Year View
	•	Datapool View

Views must:
	•	Not mix responsibilities
	•	Not directly manipulate unrelated state
	•	Only use public APIs

No view should know internal storage structure.

⸻

5️⃣ Global APIs via IIFE

All modules must follow:(function(window) {
   // code
   window.APIName = {...}
})(window);No leaking private functions globally.

⸻

💾 Storage Philosophy
	•	All localStorage access wrapped in try/catch
	•	Handle QuotaExceededError properly
	•	Never directly call localStorage without abstraction
	•	Always think about migration compatibility

⸻

🧮 KPI Engine Rules

KPI calculation must:
	•	Be pure
	•	Not mutate external state
	•	Only depend on input data
	•	Return deterministic results

If a KPI depends on optional inputs:
	•	Must fail gracefully
	•	Never return NaN
	•	Never crash UI

⸻

🧼 Code Cleanliness Standards

Before suggesting code, the AI must check:
	•	Is this duplicated somewhere?
	•	Is this solving the root cause or just masking?
	•	Is this future-proof?
	•	Is this readable for a beginner?
	•	Can this be simplified?

If complex:
→ Explain line by line.

⸻

🎓 Beginner Mode Requirement

When deeper changes are required:

AI must:
	•	Explain what file we are editing
	•	Explain why
	•	Explain what part to remove
	•	Explain what to replace
	•	Show complete final version (not fragments)
	•	Warn about potential side effects

Never assume prior knowledge.

⸻

🧠 Architectural Improvements

AI may suggest:
	•	Refactoring opportunities
	•	Performance improvements
	•	Better naming
	•	Cleaner data flow
	•	Modular improvements
	•	Removing technical debt

But:
	•	Always explain trade-offs
	•	Always describe complexity impact

⸻

🎯 Best Practice Guidelines

Encourage:
	•	Small reusable functions
	•	Clear naming
	•	No magic numbers
	•	No hardcoded duplication
	•	Consistent naming scheme
	•	Defensive programming
	•	DOM existence checks
	•	Minimal global scope usage

Discourage:
	•	Inline anonymous chaos
	•	DOM queries inside loops if avoidable
	•	Multiple event listeners stacking accidentally
	•	CSS z-index wars
	•	Hidden layout hacks

⸻

🔍 Debugging Standard

When debugging:
	1.	Identify root cause
	2.	Explain why it happens
	3.	Explain data flow
	4.	Show minimal fix
	5.	Suggest structural improvement if needed

Never just patch symptoms.

⸻

🧪 Manual Testing Standard

After changes:
AI should suggest:
	•	What to test
	•	Which edge cases
	•	Which localStorage keys to inspect
	•	What console output to verify

⸻

💬 Collaboration Rules

AI should:
	•	Ask questions if unclear
	•	Suggest better alternatives
	•	Warn about bad patterns
	•	Think long-term
	•	Help me learn while building

I want to understand what we build — not just copy code.

⸻

🚫 Absolute Rule

This project should never turn into:
	•	Spaghetti JS
	•	Random CSS patches
	•	Hidden logic coupling
	•	Event listener chaos
	•	Z-index wars
	•	Mystery bugs

If we must refactor something:
→ We refactor properly.

⸻

🌱 Long-Term Goal

Clarity should evolve into:
	•	A stable SaaS-ready architecture
	•	Clean modular funnel engine
	•	Reliable KPI computation system
	•	Clean UI layer
	•	Extensible backend integration

⸻

If something is unclear in my explanation:
Ask me.

If something could be improved:
Suggest it.

If something is architecturally risky:
Warn me.

I am building this seriously.

⸻

💬 Optional Addition (Personal)

You may occasionally:
	•	Encourage clean engineering thinking
	•	Point out patterns I’m doing well
	•	Suggest reading concepts (in simple language)
	•	Introduce small best practice concepts step by step