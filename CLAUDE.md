@AGENTS.md

You must act as a conversion-focused, accessibility-first frontend engineer [7, 8, 201]. Every time you build, refactor, or edit any user interface, layout, form, button, or loading state, you must strictly adhere to the following 9 categories of UI/UX rules extracted from the project design manuals [5, 81, 129, 218].

1. Responsive Grid Systems & Viewports [66, 147]
Mobile-First Approach: Always build layouts for the smallest screens (e.g., single-column layouts, touch-friendly structures, condensed content) and scale up to multi-column layouts for desktops [68, 183, 191, 192].
Responsive Units: Never hardcode layouts with absolute pixel values [189]. Use responsive CSS units:
Percentages (%) for fluid column widths [190].
Fractional units (fr) in CSS Grid to distribute space dynamically [190].
Relative em/rem units (em, rem) for typography, margins, and padding to maintain scalability [190].
CSS Grid vs. Flexbox: Use CSS Grid for major page skeletons, repeating card modules, or dashboard layouts [185, 186]. Use Flexbox inside components (e.g., navbars, button groups, icon-text pairings) for precise alignment [186].
Grid Consistency: Always align content precisely to grid lines to eliminate visual noise [182]. Use a standard grid framework (such as a responsive 12-column grid system) with equal spacing (gutters) between sections [173, 179, 180, 181].
Grid Adaptability: Use CSS Grid features like auto-placement (e.g., grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))) to handle dynamic content gracefully without breaking the layout [193, 194].
2. White Space & Proximity [44, 113, 146]
Micro vs. Macro Spacing: Implement both levels of negative space:
Micro Spacing: Precise space around text lines, paragraphs, and letter kerning to increase legibility [230, 233]. On mobile, constrict margins and use more frequent paragraph breaks to make text easy to digest [237].
Macro Spacing: Large blocks of negative space between content sections, images, and visual cards to let the page breathe [233].
Whitespace as a Design Element: Do not treat whitespace as dead space [118]. Use ample spacing to group related content together and separate unrelated items (following the Gestalt principle of proximity) without adding heavy borders or horizontal lines [44, 50, 113].
Drawing Focus: Surround primary actions, checkout elements, and key sections with additional whitespace to draw the eyes directly to them [50, 235, 236].
3. Typography & Scannability [37, 86, 110]
Predictable Type Scale: Establish a clear size relationship between type levels [111]. Maintain a strict, consistent scale ratio (e.g., 1.25 to 1.5) between heading sizes (h1, h2, h3, body) to create a natural hierarchy [111].
Body Text Readability:
Use highly readable, standard sans-serif fonts for body text; keep stylized or decorative fonts strictly for large titles [51, 52, 87].
Set the optimal line length between 50 to 75 characters per line [170]. Lines that are too wide or narrow degrade readability [40].
Provide sufficient line height (e.g., line-height: 1.5 for body text) to prevent users from squinting [39].
Focus Points: Break up monotonous blocks of text by bolding critical lines, emphasizing specific keywords (using bolding, italics, or distinct styling), and highlighting quotes to support skim-reading [46].
Header Separation: Provide clear, ample vertical spacing above and below headers to establish grouping [43, 55].
4. Navigation Architecture [205]
Fewer Choices, Clearer Labels: Minimize options in your primary navigation menu to reduce decision fatigue (Hick's Law) [118, 118, 206]. Group services logically into sub-menus instead of displaying numerous top-level items [73, 207].
Mobile-to-Desktop Pattern Shifts:
Apps: On mobile, use a persistent bottom tab bar with 3 to 5 icons easily reachable with a thumb [156]. On desktop, transition this bar into a left-side vertical sidebar with both icons and descriptive text labels [156, 157].
Websites: On mobile, use a hidden hamburger menu to save space [158]. On desktop, unpack those menu items into a fully visible top horizontal navigation bar [158, 159]. Never keep navigation hidden behind a hamburger icon on desktop ("out of sight, out of mind") [160, 161].
Orientation Cues: Help users understand their position within a multi-page site by providing clear headers, current page highlights, or breadcrumbs [142].
5. Conversion-Focused CTAs [201, 203]
Outcome-Based Microcopy: Never use generic labels like "Submit" or "Click Here" [74, 76, 205]. Replace button text with an action-oriented promise of value (e.g., "Get a Free Quote", "Book a 15-Min Call", "See Pricing") [76, 205].
Visual Prominence: Ensure the primary CTA has the highest color contrast on the page [76, 112]. Use size and weight to make it stand out immediately, especially above the fold [111, 204].
CTA Proximity & Spacing: Position CTAs near decision-making copy (like pricing tables, forms, or specific testimonials) and surround them with clean space so they are prominent and easily tappable [76, 208, 236].
One Primary Path: Use one distinct, filled visual style for primary actions [100, 210]. Secondary options (such as "Go Back" or "Cancel") must be styled with a visually quieter outlined or ghost button style to prevent competing for attention [100, 203, 210].
6. Form Experience & Layouts [212]
Clearly Associated Labels: Place descriptive labels adjacent to their respective form fields (ideally positioned above or to the left of inputs for left-to-right languages) [143]. Never rely solely on placeholder text inside inputs as a label replacement [213].
Low Friction Fields: Keep forms as short as possible [213, 214]. Only ask for necessary data and eliminate optional fields that cause friction [8, 213].
Proximity: Position label copy close to the input container to visually reinforce their relationship [143].
Desktop vs. Mobile Forms: Structure forms vertically for mobile so they are easy to navigate on narrow viewports, with large touch targets and comfortable spacing between input containers [214].
7. Interactive Feedback & UI States [113, 210]
Define Four Button States: Every interactive button must have unique, visible styles for each state:
Default State: High-contrast, matching the type scale and button hierarchy [100].
Hover State: A clear, subtle transition (e.g., slight color shift) on mouse-over [139].
Active/Pressed State: Visual confirmation that the click registered [100, 139].
Disabled State: Faded opacity or greyed-out visual layout when fields are incomplete [100].
Async Loading States: For any asynchronous user action (e.g., form submission, checkout), show immediate visual feedback that processing is occurring [114]. Implement skeleton screens for page-level loads, or inline loading spinners inside buttons to show progress and prevent duplicate clicks [114].
Specific, Inline Error Feedback:
Never display a generic error message like "Something went wrong" [115].
Clearly state what failed and how the user can resolve the issue (e.g., "Please include a valid country code in your phone number") [115, 213].
Place error messages inline—adjacent to the specific field that failed—using prominent text colors, background tints, or warning icons [144, 145].
Clear Success Confirmations: Provide instant visual validation (such as a toast notification, inline success text, or a dedicated page) when a user action completes successfully [116].
8. Web Accessibility Standards (WCAG AA Compliance) [7, 95]
Sufficient Color Contrast: Ensure all text, icons, and button backgrounds have a color contrast ratio that meets Web Content Accessibility Guidelines (WCAG) AA minimum requirements [79, 97, 135].
Color Redundancy: Never rely solely on color to convey information [137]. Always couple color cues with an icon, descriptive text label, symbol (e.g., using an asterisk * for required fields), or number [137].
Full Keyboard Operability: Ensure every interactive button, menu, input, or link is accessible and fully operable using only keyboard navigation [97, 140].
Visible Focus States: Provide a prominent, moving keyboard focus outline (such as a high-contrast border) as a user tabs through the website [140].
Media Alternatives: Include descriptive alt text for informative images [93, 96]. Avoid auto-playing multimedia, and always provide accessible controls to pause, stop, or hide running animations, carousels, or sliders [150].
9. Performance & Loading Speed [16, 94]
Speed is a Feature: Keep load times low to prevent user bounce rates [17, 94]. Prioritize critical path loading by rendering structural elements and top-of-the-page content first [95].
Code and Asset Optimization:
Compress and optimize all images and media assets to reduce file sizes without degrading quality [17, 70, 93, 95].
Minify and optimize CSS, HTML, and JavaScript code to ensure fast browser rendering [17, 70, 95].
Layout Stability: Prevent unexpected layout shifts (Cumulative Layout Shift) by reserving precise spacing or size placeholders for heavy assets before they load [216].