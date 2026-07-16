# EmerCard UI/UX Redesign Prompt

Redesign the existing EmerCard web application to improve usability, visual consistency, accessibility, and clarity across its public, authenticated-user, admin, emergency-profile, and content surfaces.

The redesign should preserve the current routes, features, business logic, and supported workflows. Focus on improving the information architecture, interaction design, visual hierarchy, component consistency, responsive behavior, system feedback, and overall product experience.

## Product context

EmerCard is an emergency medical profile platform connected to physical NFC and QR-enabled cards.

A user creates and maintains an emergency medical profile. An administrator provisions a physical card, links it to the user, verifies the encoded emergency URL, issues the card, and activates the public link.

When someone scans the card, they are taken to a public emergency profile containing critical medical information and emergency contacts.

The most important end-to-end journey is:

**Profile completion → card provisioning → NFC or QR scan → emergency information**

The product must feel trustworthy, calm, clear, and dependable. It handles potentially urgent medical information, so usability and information clarity are more important than decorative visual effects.

---

# Redesign scope

There are 14 route templates representing 13 distinct screen designs because the `/404` route reuses the emergency-profile visual language.

## Public and authentication

### `/`

Marketing landing page.

Purpose:

- Explain what EmerCard is.
- Communicate how NFC and QR emergency cards work.
- Build trust.
- Encourage visitors to register or learn more.
- Introduce key benefits, target users, security, and emergency use cases.

### `/login`

Login screen.

Purpose:

- Allow users and administrators to sign in.
- Make the login experience simple and focused.
- Clearly communicate validation errors and authentication status.

### `/register`

Account registration screen.

Purpose:

- Allow a visitor to create an account with email and password.
- Explain the next step after registration.
- Communicate password requirements and validation clearly.

---

## User application

### `/app`

Account overview and profile-readiness summary.

Purpose:

- Show whether the user's emergency profile is ready.
- Surface missing or incomplete information.
- Show card and public-link status.
- Guide the user toward the most important next action.
- Provide a clear overview without overwhelming the user.

### `/app/profile`

Medical-profile editor with emergency-page preview.

Users can enter and update:

- Display name
- Birth year
- Gender
- Blood type
- Critical allergies
- Medical conditions
- Medications
- Emergency note
- One or more emergency contacts

Purpose:

- Make a long medical form manageable.
- Clearly distinguish required, recommended, and optional fields.
- Show validation and readiness status.
- Provide a live or near-live preview of the public emergency profile.
- Allow users to understand exactly what information will be publicly visible.
- Warn users before exposing sensitive information.
- Make saving and unsaved-change states obvious.

### `/app/cards`

User card and public-link management.

Purpose:

- Show all physical cards associated with the user.
- Show card status and public-link status separately.
- Allow supported actions such as:

  - Activate link
  - Disable link
  - Revoke link
  - Report card lost

- Explain the consequences of destructive actions.
- Clearly show whether a card is usable during an emergency.

---

## Admin application

### `/admin`

Admin dashboard.

The current screen is an empty starting state.

Redesign it as an operational dashboard that helps administrators understand current work and quickly access common actions.

Possible content:

- Unprovisioned cards
- Pending links
- Cards awaiting encoding verification
- Cards ready to issue
- Disabled or lost cards requiring attention
- Recently provisioned cards
- Primary admin shortcuts
- Operational warnings or exceptions

Do not invent unsupported analytics or business features. Use only information that reasonably supports the existing provisioning workflow.

### `/admin/cards`

Card inventory and high-level card actions.

Purpose:

- Allow administrators to find and manage cards efficiently.
- Show card identifiers, status, assigned user, link status, and relevant dates.
- Support searching, filtering, sorting, and pagination where appropriate.
- Make the next operational action visible.
- Make status differences easy to scan.

### `/admin/cards/detail?cardId=…`

Card provisioning, linking, encoding verification, and lifecycle management.

Purpose:

- Guide the administrator through the full card lifecycle.
- Reduce mistakes during provisioning.
- Make the current card state and next allowed action explicit.

The operational sequence is:

1. Select or create a blank card.
2. Attach a pending user link.
3. Encode the generated emergency URL onto the card.
4. Scan or re-enter the encoded URL.
5. Verify that the encoded URL matches.
6. Issue the physical card.
7. Activate the public link.

The screen should behave like a guided operational workspace rather than a generic detail page.

Include:

- Card identity and current status
- Assigned user
- Attached link
- Emergency URL
- Encoding verification state
- Provisioning progress
- Activity or lifecycle history where supported
- Contextual actions
- Warnings for invalid transitions
- Confirmation dialogs for destructive actions

Actions may include:

- Attach link
- Verify encoded URL
- Issue card
- Activate link
- Disable link
- Re-enable link
- Revoke link
- Report lost
- Replace card
- Void card

The UI must prevent or discourage actions that are not valid in the card's current state.

### `/admin/links`

Find a user and create or manage pending profile links.

Purpose:

- Search for a user by email.
- Confirm the selected user before creating a link.
- Show whether the user's profile is ready.
- Create a pending link.
- Display existing pending or active links.
- Prevent accidental duplicate links where appropriate.
- Make the relationship between user, profile, link, and physical card understandable.

---

## Emergency and public profile

### `/e/{token}`

Public emergency medical profile.

This is the most safety-critical screen in the product.

It must prioritize immediate comprehension under stressful conditions.

The page may show:

- Person's name
- Birth year or age information
- Gender
- Blood type
- Critical allergies
- Medical conditions
- Medications
- Emergency note
- Emergency contacts
- Tap-to-call actions

Design principles:

- Place the most critical medical information first.
- Use large, readable typography.
- Use clear labels rather than relying only on icons.
- Make emergency contacts highly visible.
- Make tap-to-call actions easy to use with one hand.
- Avoid unnecessary navigation and distractions.
- Ensure strong contrast and mobile-first usability.
- Do not require authentication.
- Do not expose private account-management controls.
- Clearly communicate that the page is an emergency information profile rather than a diagnosis or official medical record.

The page must also support unavailable or invalid states:

- Pending
- Disabled
- Revoked
- Expired
- Profile not ready
- Token not found
- Generic unavailable state

Each state should have:

- A clear status title
- A brief explanation
- Appropriate next guidance
- No exposure of private information
- A visual treatment consistent with the emergency-profile system

### `/404`

Not-found fallback.

Reuse the visual language of the emergency-profile unavailable states, while clearly indicating that the requested page or emergency profile could not be found.

---

## Blog and content

### `/blog`

Blog listing.

Purpose:

- Present articles in a clean and readable content layout.
- Support content discovery.
- Make article metadata and summaries easy to scan.
- Maintain visual connection to the EmerCard brand without looking like an internal application screen.

### `/blog/{slug}`

Reusable blog article template currently used for nine articles.

Purpose:

- Optimize reading comfort.
- Provide consistent typography for headings, paragraphs, lists, images, quotes, and callouts.
- Support article metadata.
- Include appropriate navigation back to the blog.
- Use one reusable template rather than designing each article separately.

---

# Supported user flows

## Visitor to account

**Landing → Register → Login → role-based destination**

Requirements:

- Registration and login should feel like one connected onboarding experience.
- After registration, clearly explain that the user must log in.
- After login:

  - Normal users go to `/app`.
  - Administrators go to `/admin`.

- Avoid exposing role-selection controls unless the current product explicitly supports them.

## User medical-profile readiness

**User overview → Medical profile → Save → Preview readiness**

Requirements:

- Show profile readiness as a meaningful status, not only a percentage.
- Explain what is missing.
- Allow users to move directly to incomplete sections.
- Show what will be visible on the emergency page.
- Make saving progress and validation clear.
- Keep the experience usable for users with limited technical confidence.

## Admin card provisioning

**Admin links → Create pending link → Card inventory → Card detail → Attach link → Verify encoded URL → Issue → Activate**

Requirements:

- Turn this flow into a guided, low-error operational journey.
- Show completed, current, and future steps.
- Explain prerequisites for each step.
- Disable or hide invalid actions.
- Provide meaningful success, warning, and error feedback.
- Preserve context when moving between link creation, card inventory, and card detail.
- Make it easy to return to unfinished provisioning work.

## Emergency scan

**NFC or QR scan → `/e/{token}` → public emergency profile**

Requirements:

- Optimize for mobile devices.
- Assume the viewer may be in a hurry or under stress.
- Present critical information immediately.
- Avoid loading unnecessary content before the primary medical information.
- Make emergency contact actions prominent.
- Handle unavailable states safely and clearly.

## Card and link lifecycle

User controls:

- Activate link
- Disable link
- Revoke link
- Report card lost

Admin controls:

- Issue card
- Activate link
- Disable link
- Re-enable link
- Revoke link
- Report lost
- Replace card
- Void card

Requirements:

- Distinguish physical-card status from public-link status.
- Use human-readable labels.
- Explain the consequences of every destructive or security-sensitive action.
- Require confirmation for revoke, lost, replace, and void actions.
- Show the resulting status after an action succeeds.
- Avoid status colors as the only method of communication.

---

# UX redesign goals

## 1. Improve information architecture

Create a clear separation between:

- Marketing and public content
- Authentication
- User account management
- Admin operations
- Public emergency information

The authenticated user and admin areas should share a coherent product shell and component system while still reflecting their different responsibilities.

The public emergency page should not use the full authenticated application shell.

## 2. Make status understandable

The product contains multiple related states:

- Profile readiness
- Physical-card state
- Card assignment state
- Link state
- Encoding verification state
- Issuance state
- Emergency-profile availability

Design a consistent status system with:

- Human-readable labels
- Status badges
- Short explanations
- Appropriate icons
- Clear next actions
- Accessible color usage

Avoid displaying internal enum names directly to users.

## 3. Reduce operational errors

Admin workflows should clearly communicate:

- What has already been completed
- What must happen next
- Which actions are currently available
- Why an action is blocked
- Whether a card is safe to issue
- Whether the encoded URL has been verified
- Whether the emergency page is publicly accessible

Use progressive disclosure rather than placing every action on the screen at once.

## 4. Improve form usability

For the medical-profile editor:

- Group fields into logical sections.
- Use plain-language field descriptions.
- Explain why information is requested.
- Mark required, recommended, and optional information.
- Support multiple emergency contacts clearly.
- Show inline validation.
- Preserve entered data when validation fails.
- Provide clear save, saved, saving, and unsaved states.
- Consider a sticky save action on long forms.
- Use a responsive preview layout.

## 5. Improve mobile experience

The following screens must be strongly mobile-optimized:

- Landing page
- Login
- Registration
- User overview
- Medical-profile editor
- User cards
- Emergency profile
- Blog pages

The emergency profile must be designed mobile-first.

Admin screens may prioritize desktop use but should remain functional on tablets and smaller screens.

## 6. Improve accessibility

Target WCAG 2.2 AA where practical.

Requirements:

- Strong color contrast
- Keyboard navigation
- Visible focus states
- Semantic heading structure
- Accessible labels and error messages
- Touch targets of appropriate size
- Do not communicate state using color alone
- Avoid small or low-contrast medical information
- Respect reduced-motion preferences
- Avoid decorative animation in urgent workflows
- Ensure dialogs and menus work with assistive technologies

## 7. Build trust

The interface should feel:

- Calm
- Dependable
- Professional
- Human
- Privacy-aware
- Appropriate for healthcare-related information

Avoid making the product look overly clinical, alarming, playful, or futuristic.

Use reassuring language and clear privacy explanations.

---

# Visual design direction

Create a modern healthcare-oriented product aesthetic without copying hospital software.

Recommended characteristics:

- Clean and spacious layouts
- Strong but calm typography
- Clear hierarchy
- Soft neutral surfaces
- Restrained use of a medical red accent for urgent or destructive states
- A trustworthy primary brand color
- Rounded corners used moderately
- Subtle elevation
- Minimal decorative effects
- Clear data and status presentation
- Consistent iconography
- High readability

Do not overuse:

- Gradients
- Glassmorphism
- Excessive shadows
- Oversized decorative cards
- Pill-shaped controls everywhere
- Dense dashboards
- Unnecessary animations
- Medical imagery that could feel distressing
- Red as the primary color for normal navigation or neutral actions

Emergency information should use emphasis carefully. Red should indicate critical information, unavailable states, or destructive actions, not decorate the entire page.

---

# Application shell

Create one coherent authenticated application system for both users and administrators.

Consider:

- Desktop sidebar navigation
- Compact mobile navigation
- Page title and contextual actions
- Account menu
- Role-aware navigation
- Breadcrumbs for deeper admin flows
- Consistent content width
- Consistent spacing system
- Empty, loading, error, and success states

Suggested user navigation:

- Overview
- Medical profile
- My cards

Suggested admin navigation:

- Dashboard
- Cards
- Links

Do not expose admin navigation to regular users.

---

# Component system

Create reusable components and patterns for:

- Buttons
- Form fields
- Selects
- Text areas
- Search inputs
- Password inputs
- Checkboxes
- Radio controls
- Status badges
- Alert banners
- Toast notifications
- Cards
- Tables
- Empty states
- Loading skeletons
- Confirmation dialogs
- Step indicators
- Progress summaries
- Tabs where necessary
- Mobile bottom actions where appropriate
- Emergency contact cards
- Medical-information sections
- Profile-readiness indicators
- Card identity blocks
- Lifecycle timelines
- Destructive-action confirmations

Define variants and usage rules rather than designing one-off components for each page.

---

# Important screen-specific recommendations

## User overview

Prioritize:

1. Profile readiness
2. Missing medical information
3. Public-link and card status
4. Primary next action
5. Recent or secondary information

Avoid turning the page into a generic analytics dashboard.

## Medical-profile editor

Consider a section structure such as:

1. Personal information
2. Critical medical information
3. Medications
4. Emergency note
5. Emergency contacts
6. Emergency-page visibility and preview

The exact structure may change if a better grouping improves comprehension.

## User cards

For each card, clearly show:

- Card identifier
- Physical-card status
- Public-link status
- Whether the emergency profile is currently accessible
- Last relevant update
- Available actions

Avoid combining all statuses into one ambiguous badge.

## Admin dashboard

Focus on operational queues and actionable items, such as:

- Links waiting to be attached
- Cards waiting for encoding verification
- Cards ready to issue
- Lost, disabled, or exception-state cards
- Recently completed provisioning

## Admin card detail

Use a guided lifecycle or stepper.

The current step should be visually dominant.

Show advanced lifecycle actions separately from the primary provisioning action.

## Admin links

Make user selection safe:

- Search by email
- Show user identity details
- Show profile readiness
- Require explicit confirmation before creating a link
- Show existing links before allowing another to be created

## Emergency profile

Suggested information priority:

1. Emergency identity header
2. Critical alert information
3. Blood type
4. Allergies
5. Medical conditions
6. Medications
7. Emergency note
8. Emergency contacts

Reorder based on the actual available information and urgency, but maintain a consistent hierarchy.

---

# System feedback and edge cases

Design states for:

- Initial loading
- Slow loading
- Empty data
- Validation errors
- Authentication errors
- Permission errors
- Network failures
- Save failure
- Save success
- Link creation failure
- Duplicate or existing link
- Card not found
- User not found
- Encoding mismatch
- Encoding verified
- Invalid lifecycle transition
- Lost card
- Revoked link
- Disabled link
- Expired link
- Profile not ready
- Emergency profile not found

Error messages should:

- Explain what happened.
- Tell the user what they can do next.
- Avoid exposing technical implementation details.
- Preserve the user's work where possible.

---

# Content and microcopy

Improve interface wording as part of the redesign.

Use:

- Plain language
- Short action labels
- Specific status descriptions
- Clear confirmation messages
- Calm emergency-state wording
- Explicit consequences for destructive actions

Examples:

Instead of:

- `PENDING_PROFILE_LINK`

Use:

- `Waiting to be attached to a card`

Instead of:

- `Card inactive`

Clarify whether this means:

- The physical card has not been issued
- The public link is disabled
- The card has been reported lost
- The profile is incomplete

Avoid ambiguous words such as “active” unless the interface clearly states what is active.

---

# Responsive behavior

Provide designs for relevant breakpoints:

- Mobile
- Tablet
- Desktop

At minimum, show responsive behavior for:

- Landing page
- Login and registration
- User overview
- Medical-profile editor
- User cards
- Admin cards table
- Admin card detail
- Emergency profile
- Blog listing
- Blog article

For admin tables on smaller screens, consider:

- Horizontal scrolling
- Priority-based column hiding
- Card-style row transformation
- Responsive filters

Choose the approach that preserves operational clarity.

---

# Deliverables

Produce:

1. A concise UX audit of the current screen structure and likely usability risks.
2. A redesigned sitemap and navigation model.
3. A shared design-system direction.
4. Low-fidelity wireframes for all 13 distinct screen designs.
5. High-fidelity designs for all primary screens.
6. Responsive mobile and desktop variants.
7. Component variants and states.
8. Empty, loading, error, success, disabled, and destructive-action states.
9. A clickable prototype for the four core flows:

   - Visitor registration and login
   - User profile completion
   - Admin card provisioning
   - Emergency card scan

10. Developer handoff specifications covering:

- Layout measurements
- Responsive behavior
- Typography
- Color tokens
- Spacing tokens
- Component states
- Interaction behavior
- Validation behavior
- Status mappings
- Accessibility notes

---

# Priority order

Work in this order:

## Priority 1: Core product journey

- `/app`
- `/app/profile`
- `/admin/links`
- `/admin/cards`
- `/admin/cards/detail?cardId=…`
- `/e/{token}`

## Priority 2: Account and lifecycle management

- `/app/cards`
- `/admin`
- `/login`
- `/register`

## Priority 3: Marketing and content

- `/`
- `/blog`
- `/blog/{slug}`
- `/404`

---

# Constraints

- Preserve the current routes.
- Preserve the current supported features and role model.
- Do not invent unsupported backend capabilities.
- Do not redesign the business workflow in a way that requires major backend changes unless clearly marked as an optional recommendation.
- Keep the blog article as one reusable template.
- Reuse the emergency-profile design language for `/404`.
- Treat physical-card state and public-link state as separate concepts.
- Keep the emergency profile accessible without authentication.
- Prioritize critical medical information over branding on the emergency screen.
- Ensure the user understands what information will be public.
- Design the admin provisioning workflow to reduce mistakes.
- Use reusable components rather than independent page-specific styles.

---

# Success criteria

The redesign is successful when:

- A new user can understand what to complete next.
- A user can understand whether their emergency profile is ready.
- A user can distinguish between card status and public-link status.
- An administrator can provision a card without guessing the next step.
- Invalid lifecycle actions are prevented or clearly explained.
- A person scanning the card can find critical medical information immediately.
- Emergency contacts can be called with minimal interaction.
- Unavailable emergency-profile states are clear and privacy-safe.
- All authenticated screens feel like one coherent product.
- Marketing and blog surfaces remain visually connected to the brand without looking like internal application screens.
- The interface remains usable across mobile, tablet, and desktop devices.
