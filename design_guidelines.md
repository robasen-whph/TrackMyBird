# TrackMyBird Authentication & Dashboard Design Guidelines

## Design Approach

**Selected Framework**: Modern SaaS Authentication System inspired by Linear, Vercel, and contemporary productivity tools. This approach prioritizes clarity, efficiency, and professional polish for utility-focused authentication flows.

**Core Principle**: Clean, focused interfaces that guide users through authentication with minimal friction while maintaining visual consistency with the existing map-based tracking interface.

---

## Typography System

**Font Stack**: Inter via Google Fonts CDN (primary), system fallback
- **Hero/Page Titles**: 2.5rem (text-4xl), font-weight 700, tight letter-spacing (-0.02em)
- **Section Headers**: 1.875rem (text-3xl), font-weight 600
- **Form Labels**: 0.875rem (text-sm), font-weight 500, uppercase tracking-wide
- **Body Text**: 1rem (text-base), font-weight 400, line-height 1.6
- **Helper Text**: 0.875rem (text-sm), font-weight 400
- **Button Text**: 0.9375rem, font-weight 500, letter-spacing 0.01em

---

## Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, 8, 12, 16, 24 (e.g., p-4, mt-8, gap-6)

**Authentication Page Structure**:
- Split-screen layout on desktop (lg: grid-cols-2)
- Left panel: Full-height branded content area with gradient treatment
- Right panel: Centered form container (max-w-md, centered vertically)
- Mobile: Stack to single column, branded section collapses to header banner

**Dashboard Structure**:
- Persistent top navigation bar (h-16, border-bottom)
- Sidebar navigation (w-64 on desktop, collapsible on mobile)
- Main content area with max-w-7xl container
- Generous padding (px-6 lg:px-8, py-8)

---

## Component Library

### Authentication Forms

**Form Container**:
- Width: max-w-md
- Padding: p-8
- Background: Subtle elevated surface treatment
- Border radius: rounded-xl
- Shadow: Soft elevation (shadow-lg)

**Input Fields**:
- Height: h-12
- Padding: px-4
- Border: 2px solid with focus ring (ring-2 ring-offset-2)
- Border radius: rounded-lg
- Typography: text-base
- Spacing between fields: space-y-6

**Buttons**:
- Primary CTA: h-12, w-full, rounded-lg, font-medium
- Secondary: h-10, outlined variant, rounded-lg
- Icon buttons: h-10 w-10, rounded-md for delete actions
- Spacing: mt-6 for primary submit buttons

**Form Elements**:
- Password visibility toggle: Absolute positioned right-4 icon button
- Checkbox with labels: flex items-center gap-3
- Error messages: text-sm, mt-2, with warning icon
- Success states: Checkmark icon with confirmation text

### Left Panel Branding (Auth Pages)

**Content Structure**:
- Logo placement: Top-left (p-8)
- Centered content area with max-w-lg
- Headline: text-4xl font-bold, mb-4
- Subheading: text-xl, opacity-90, mb-8
- Feature list: space-y-4, each with icon + text (grid gap-3)

**Visual Elements**:
- Decorative aircraft path illustration (abstract dotted lines forming flight pattern)
- Subtle grid pattern overlay (opacity-5)
- Gradient mesh background treatment

**Icons**: Heroicons (CDN) for all UI elements - plane, location-marker, globe, shield-check, chart-bar

---

## Page-Specific Layouts

### Signup Page

**Left Panel**:
- Headline: "Track Every Flight with Precision"
- Subheading: "Professional aircraft monitoring for pilots and enthusiasts"
- Feature bullets with icons:
  - Real-time flight tracking
  - Unlimited aircraft management
  - Detailed flight history
  - Secure cloud storage

**Right Panel Form**:
- Page title: "Create your account"
- Fields: Full Name, Email, Password, Confirm Password (all full-width)
- Terms checkbox: "I agree to Terms of Service and Privacy Policy"
- Primary button: "Create Account"
- Divider with text: "or"
- Social auth buttons: Google, Apple (h-11, outlined, with icons)
- Footer link: "Already have an account? Sign in"

### Login Page

**Left Panel**: Same branding content as signup

**Right Panel Form**:
- Page title: "Welcome back"
- Fields: Email, Password (with "Forgot password?" link aligned right)
- Remember me checkbox
- Primary button: "Sign In"
- Social auth options below divider
- Footer link: "Don't have an account? Sign up"

### Verify-Pending Page

**Full-width Centered**:
- Icon: Large envelope/mail icon (h-20 w-20)
- Headline: "Check your email"
- Body text: Email sent confirmation with user's email in styled span
- Instruction: "Click the verification link to activate your account"
- Secondary button: "Resend verification email"
- Helper text: "Didn't receive it? Check spam folder"
- Footer link: "Wrong email? Go back"

### Dashboard Page

**Top Navigation**:
- Logo + app name (left)
- Search bar (center, max-w-md)
- User menu dropdown (right, avatar + name)

**Sidebar** (hidden on mobile, slide-over menu):
- Navigation items: Dashboard, My Aircraft, Flight History, Settings
- Each with icon + label
- Active state indication

**Main Content**:
- Page header section (mb-8):
  - Title: "My Aircraft"
  - Add button: "Add Aircraft" (primary, h-10, with plus icon)
  
**Aircraft Table**:
- Container: Elevated card (rounded-xl, shadow, overflow-hidden)
- Table layout: Full-width, divided rows (divide-y)
- Columns: Aircraft Name, Registration, Type, Status, Actions
- Header row: Sticky top, font-medium, text-sm, uppercase tracking-wide
- Body rows: h-16, hover state for interactivity
- Actions column: Edit icon button + Delete icon button (gap-2)

**Empty State** (when no aircraft):
- Centered illustration (aircraft icon in circle, h-32 w-32)
- Headline: "No aircraft yet"
- Description: "Add your first aircraft to start tracking"
- Primary button: "Add Aircraft" (px-6 py-3)

**Add/Delete Modals**:
- Modal overlay: Fixed inset-0, backdrop blur
- Modal content: max-w-lg, centered, rounded-xl, p-6
- Modal header: Title + close button (absolute top-right)
- Form fields: Same styling as auth forms
- Button group: Flex justify-end, gap-3 (Cancel + Confirm)

---

## Images

**Hero Image for Left Panel** (Auth Pages):
- Description: Abstract visualization of flight paths - multiple curved dotted/dashed lines representing aircraft trajectories against a gradient sky background. Lines should converge and diverge creating an elegant pattern. Include subtle map grid overlay.
- Placement: Full background of left authentication panel, with gradient overlay for text legibility
- Treatment: Soft blur effect (backdrop-blur-sm) if text overlays directly, otherwise gradient overlay from bottom to top

**Dashboard Empty State Icon**:
- Description: Minimal line-art illustration of small aircraft (top-down view) inside a circular badge
- Placement: Centered in empty state section
- Style: Single-weight outlined icon, geometric and clean

---

## Accessibility & Polish

- All form inputs include visible labels (no placeholder-only)
- Focus states: Prominent ring treatment on all interactive elements
- Error states: Icon + text, adequate color contrast
- Loading states: Spinner icon with "Processing..." text for button states
- Keyboard navigation: Proper tab order, escape to close modals
- Screen reader labels: Aria-labels for icon-only buttons

**Micro-interactions** (minimal):
- Button press: Subtle scale transform (scale-95)
- Form field focus: Smooth ring transition
- Table row hover: Background shift
- Modal entrance: Fade + scale animation (duration-200)