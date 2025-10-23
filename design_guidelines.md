# TrackMyBird Design Guidelines

## Design Approach
**Hybrid Approach**: Material Design foundation with inspiration from nature tracking apps (iNaturalist, Merlin Bird ID, Alltrails)

**Core Principles**:
- Data clarity with visual warmth
- Nature-inspired color palette
- Clean information hierarchy for bird tracking data
- Mobile-first responsive design

## Color Palette

### Light Mode
- **Primary**: 142 65% 45% (Forest green - evokes nature/wildlife)
- **Primary Hover**: 142 65% 38%
- **Secondary**: 25 85% 55% (Earthy terracotta for CTAs)
- **Background**: 40 20% 97% (Warm off-white)
- **Surface**: 0 0% 100%
- **Text Primary**: 220 15% 20%
- **Text Secondary**: 220 10% 45%
- **Border**: 220 15% 85%
- **Success**: 142 70% 45% (Sightings confirmed)
- **Warning**: 45 90% 55% (Pending identification)
- **Error**: 0 75% 55%

### Dark Mode
- **Primary**: 142 55% 55%
- **Primary Hover**: 142 55% 48%
- **Secondary**: 25 75% 60%
- **Background**: 220 15% 10%
- **Surface**: 220 12% 14%
- **Text Primary**: 40 20% 95%
- **Text Secondary**: 220 8% 65%
- **Border**: 220 10% 25%

## Typography

**Font Stack**:
- Headings: Inter (500-700 weight) via Google Fonts
- Body: Inter (400-500 weight)
- Data/Mono: JetBrains Mono (for coordinates, timestamps)

**Scale**:
- Hero/Page Title: text-4xl md:text-5xl font-bold
- Section Headers: text-2xl md:text-3xl font-semibold
- Card Titles: text-lg font-medium
- Body: text-base
- Captions/Meta: text-sm text-secondary

## Layout System

**Spacing Units**: Consistent use of 4, 6, 8, 12, 16, 24 (p-4, p-6, p-8, gap-12, py-16, py-24)

**Container Strategy**:
- Max width: max-w-7xl for main content
- Map views: Full width with overlay controls
- Data cards: max-w-sm to max-w-md
- Lists: max-w-4xl for readability

**Grid Patterns**:
- Bird cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Statistics: grid-cols-2 md:grid-cols-4
- Detail views: Two-column layout (image/map + details)

## Component Library

### Navigation
- Top app bar with logo, search, user profile
- Bottom navigation for mobile (Home, Map, Add Sighting, Profile)
- Breadcrumbs for nested views

### Data Display
- **Bird Sighting Cards**: Image thumbnail, species name, date/time, location, confidence badge
- **Statistics Panels**: Count badges with icons, trend indicators
- **Timeline View**: Vertical timeline for chronological sightings
- **Map Integration**: Interactive map with custom bird markers, clustering for dense areas
- **Species Detail Pages**: Large hero image, scientific name, identification guides, sighting history

### Forms
- **Add Sighting Form**: Photo upload, location picker (map), date/time selectors, notes textarea
- **Search**: Global search with autocomplete for species names
- **Filters**: Drawer-based filters for date range, location, species

### Interactive Elements
- **Photo Gallery**: Lightbox modal for full-size bird images
- **Location Picker**: Interactive map with current location button
- **Species Autocomplete**: Dropdown with bird illustrations
- **Export Data**: Download sightings as CSV/JSON

### Overlays
- **Confirmation Modals**: Delete sighting, clear filters
- **Info Sheets**: Bottom sheet for quick bird information
- **Toast Notifications**: Success/error feedback for actions

## Images

### Hero Section
**Large Hero Image**: Yes - Nature/wildlife composite featuring diverse bird species in natural habitat
- Placement: Top of homepage/dashboard
- Height: 60vh on desktop, 40vh on mobile
- Overlay: Subtle dark gradient (bottom-to-top) for text readability
- CTA Buttons: Use blurred backgrounds with variant="outline"

### Throughout App
- Bird sighting thumbnails (square, 200x200px minimum)
- Species profile headers (16:9 landscape)
- User profile avatars (circular)
- Empty states with bird illustrations
- Map markers (custom bird icons)

## Animation Guidelines
**Minimal and Purposeful**:
- Card hover: Subtle lift (translate-y-1, shadow increase)
- Modal entry: Fade + scale from 95% to 100%
- Toast notifications: Slide in from top
- Map markers: Gentle bounce on add
- NO parallax, NO scroll-triggered animations

## Accessibility
- Maintain WCAG AA contrast ratios
- Focus indicators on all interactive elements (ring-2 ring-primary)
- Alt text for all bird images with species names
- Keyboard navigation for map controls
- Screen reader labels for icon-only buttons
- Consistent dark mode across all form inputs and controls