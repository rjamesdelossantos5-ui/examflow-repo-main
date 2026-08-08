@AGENTS.md

="space-y-3">
      <div class="grid grid-cols-3 gap-4">
        <div class="h-2 bg-slate-200 col-span-2"></div>
        <div class="h-2 bg-slate-200 col-span-1"></div>
      </div>
    </div>
  </div>
</div>
Part 5: Humanized Error Messages
Core Principle: Errors happen, but they shouldn't alienate the user. Messages must be clear, polite, jargon-free, and actionable.
Anti-Pattern (Bad): Displaying raw database logs or cold codes like: Error 500: Database connection pool exhausted.
Claude Code Instruction:
"Write error messages that follow a 3-step formula:

Say what happened in plain, friendly English.
Explain why it happened (if useful).
Provide a clear button/link to fix it (e.g., 'Try Again' or 'Contact Support')."
Good UI Code Example:
<div class="p-6 border border-red-200 bg-red-50 rounded-lg text-center">
  <h3 class="text-red-800 font-semibold">We couldn't save your changes</h3>
  <p class="text-red-600 text-sm mt-1">Your internet connection seems a bit unstable. Let's try saving that again.</p>
  <button class="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Retry Saving</button>
</div>
Part 6: Form Friction Reduction
Core Principle: Forms are high-friction hurdles. Reduce cognitive load by keeping them single-column, logically grouped, and clean.
Anti-Pattern (Bad): Crowded, multi-column forms with optional fields scattered everywhere and confusing labels.
Claude Code Instruction:
"When generating forms:

Group inputs logically using clear section headers.
Place labels directly above inputs (never inside them as placeholders).
Highlight optional fields explicitly instead of marking mandatory ones with a confusing red asterisk (*).
Support auto-fill tags (autocomplete) and natural tab indexing."
Part 7: Inline Error Placement
Core Principle: Error messages must live exactly where the correction needs to take place.
Anti-Pattern (Bad): A list of 5 errors compiled at the very top of a long form, forcing the user to scroll down and guess which input failed.
Claude Code Instruction:
"Do not display form errors in a global list at the top. Instead, map error states inline directly under the invalid input field, highlight the border in red, and focus the first invalid field automatically on submit fail."

Good UI Code Example:
<div class="flex flex-col gap-1">
  <label for="email" class="text-sm font-medium text-gray-700">Email Address</label>
  <input id="email" type="email" class="border-red-500 focus:ring-red-500 rounded-md p-2 border" />
  <span class="text-xs text-red-600">Please enter a valid email address containing '@'.</span>
</div>
Part 8: Interactive Empty States
Core Principle: Empty screens are prime onboarding real estate, not dead ends. Make them warm, helpful, and highly actionable.
Anti-Pattern (Bad): Showing a blank layout with a tiny, depressing text string like "No entries found today."
Claude Code Instruction:
"Every empty state (such as empty search results, empty dashboards, or empty carts) must feature:

A friendly illustration or icon.
A clear headline explaining why the screen is empty.
An explanatory line showing how to get started.
A prominent Call-to-Action (CTA) button (e.g., 'Create Your First Entry' or 'Start Shopping') to guide the next step."
Good UI Code Example:
<div class="flex flex-col items-center text-center p-8 border border-dashed rounded-lg bg-gray-50">
  <svg class="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">...</svg>
  <h3 class="mt-4 text-lg font-semibold text-gray-900">No projects yet</h3>
  <p class="mt-1 text-sm text-gray-500">Create your first project to start tracking your team's progress easily.</p>
  <button class="mt-6 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">+ Create Project</button>
</div>
Part 9: Graceful Degradation & Partial States
Core Principle: A single broken API endpoint should never bring down your entire interface. Isolate failures so the rest of your app remains usable.
Anti-Pattern (Bad): A failed API call causes a React application to throw an unhandled boundary error, rendering a blank white screen.
Claude Code Instruction:
"Implement robust React Error Boundaries or try/catch blocks on individual dashboard components. If a component fails to load, replace only that card/section with a localized fallback card containing a retry button, allowing the user to interact with other fully-functional components."

Part 10: Complete Button States
Core Principle: A button is an active conversation. If a user clicks it, they need immediate, unequivocal feedback that their click was registered.
Anti-Pattern (Bad): Clicking a 'Submit' button with no hover reaction, active state, or loading spinner, leading to frustrated double-clicking (and duplicate database entries).
Claude Code Instruction:
"Ensure all interactive button elements support 5 distinct visual states:

Default: Clear visual priority.
Hover: Slight elevation or color change on pointer hover.
Active/Pressed: Slight scale down or inset shadow on click.
Disabled: Grayed out and unclickable.
Loading: Replaces the button text with a spinner or 'Processing...' message, and disables pointer events to prevent duplicate submissions."
Part 11: Delighted Success States
Core Principle: Completing an important user action is a celebratory milestone. Reassure the user that everything went smoothly.
Anti-Pattern (Bad): Submitting a payment or completing a long onboarding sequence only to have the app silently redirect to the homepage without warning.
Claude Code Instruction:
"On major task success (e.g., checkout, account creation, form submission):

Show a prominent, clear Success State screen or modal.
Use clear visual indicators (e.g., a green checkmark) and friendly confirmation copy.
Optionally, trigger a light confetti animation or smooth celebratory transition to leave a delightful lasting impression."
Part 12 & 13: Jakob's Law (Familiar Design Standards)
Core Principle: Users spend 99% of their time on other sites. They expect your site to work just like the ones they already know.
Anti-Pattern (Bad): Inventing custom navigation structures, proprietary iconography, or unrecognizable interactive flows just to be 'unique'.
Claude Code Instruction:
"Prioritize standard, predictable web layout conventions over hyper-experimental UIs. Navbars must live at the top or left; search should be easy to find with magnifying glass iconography; shopping carts must occupy the top right. Align your layout structure to standard patterns to minimize cognitive friction."

Part 14: Hick's Law (Keep It Simple)
Core Principle: The time it takes to make a decision increases with the number and complexity of choices. Minimizing options maximizes conversions.
Anti-Pattern (Bad): Flooding a landing page with 15 different links, multiple parallel navigation paths, and 5 different primary CTAs competing for attention.
Claude Code Instruction:
"Reduce decision fatigue. Simplify options by:

Keeping to a single Primary CTA per view.
Hiding advanced options behind a progressive disclosure layout (e.g., an 'Advanced Settings' expander).
Restricting primary navigation menus to 5-7 key items."
