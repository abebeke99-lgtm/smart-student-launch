# Google Maps Integration - Quick Reference

## What Was Implemented

### ✅ Complete
- [x] Google Maps embed integrated into Contact Us page
- [x] Correct location: Gimba, Tulu Awuliya, Amhara Region, Ethiopia
- [x] Map marker on Mekdela Amba University campus
- [x] Responsive design (100% width, 450px height)
- [x] Interactive map (zoom, pan, drag)
- [x] "View on Google Maps" link
- [x] Campus address display
- [x] P.O. Box information
- [x] Lazy loading for performance
- [x] Mobile-friendly design
- [x] Proper accessibility attributes

## File Structure

```
IPES/
├── frontend/src/
│   ├── components/
│   │   └── MapEmbed.jsx                 (NEW)
│   └── pages/
│       └── Contact.jsx                  (UPDATED)
├── GOOGLE_MAPS_INTEGRATION_GUIDE.md     (NEW)
├── GOOGLE_MAPS_SETUP_GUIDE.md          (NEW)
└── GOOGLE_MAPS_QUICK_REFERENCE.md      (THIS FILE)
```

## Key Coordinates

| Item | Value |
|------|-------|
| Latitude | 10.886480 |
| Longitude | 40.248944 |
| Location | Gimba, Tulu Awuliya, Amhara, Ethiopia |
| P.O. Box | P.O. Box 32 |

## Map Configuration

### MapEmbed.jsx Properties

```jsx
<iframe
  src="https://www.google.com/maps/embed?pb=!1m18!..."
  width="100%"           // Full responsive width
  height="450"           // Adjustable height in px
  style={{ border: 0 }}  // No border
  allowFullScreen=""     // Enable fullscreen
  loading="lazy"         // Lazy loading
  referrerPolicy="no-referrer-when-downgrade"
  title="Mekdela Amba University Location"
/>
```

## How to Update Map

### Quick Update (Copy-Paste)

1. **Get new embed from Google Maps:**
   - Go to https://www.google.com/maps
   - Search: "Mekdela Amba University"
   - Click menu (≡) → Share or embed map → Embed a map
   - Copy the `src` URL

2. **Update MapEmbed.jsx:**
   ```jsx
   src="PASTE_NEW_URL_HERE"
   ```

### Change Map Height

**In MapEmbed.jsx:**
```jsx
height="450"  // Change 450 to desired height
```

## Component Integration

### Contact.jsx Uses

```jsx
import MapEmbed from '../components/MapEmbed';

// Inside return JSX:
<MapEmbed />
```

### Renders As

```
┌─────────────────────────────────────────┐
│  Contact Us (Page Header)              │
├─────────────────────────────────────────┤
│  Contact Information (Left Column)      │
│  - Email Card                          │
│  - Phone Card                          │
│  - Location Card                       │
│  - Office Hours Card                   │
│                                        │
│  Contact Form (Right Column)           │
│  - Name Field                          │
│  - Email Field                         │
│  - Message Field                       │
│  - Submit Button                       │
├─────────────────────────────────────────┤
│  Find Us on the Map (Full Width)       │
│  ┌─────────────────────────────────────┐│
│  │  Google Maps Embed                  ││
│  │  [Interactive Map]                  ││
│  │  Marker: Mekdela Amba University   ││
│  └─────────────────────────────────────┘│
│  Campus Address & "View on Google Maps" │
└─────────────────────────────────────────┘
```

## Contact Page Layout

**Desktop (1024px+):**
- Top: Header + Description
- Middle: 3-column grid (Info cards left, form right)
- Bottom: Full-width map section

**Tablet (768px-1023px):**
- Top: Header + Description
- Middle: Responsive grid (Info cards, form)
- Bottom: Full-width map section

**Mobile (< 768px):**
- Top: Header + Description
- Middle: Single column (Info cards, form stacked)
- Bottom: Full-width map section

## Testing Verification

### Before Deployment

```bash
# Frontend test
cd frontend
npm run dev
# Navigate to: http://localhost:5173/contact

# Verify:
✓ Map displays below form
✓ Map shows correct location (Gimba, Ethiopia)
✓ Marker is on Mekdela Amba University
✓ Map is responsive on mobile
✓ "View on Google Maps" link works
✓ Campus address displays
✓ No console errors
```

## Common Tasks

### Task 1: Adjust Map Size

**Edit:** `frontend/src/components/MapEmbed.jsx`

```jsx
// Line 9 - Change height value
height="500"  // Was 450, now 500
```

### Task 2: Update Location

**If campus moves or location changes:**

1. Get new coordinates
2. Update embed URL in MapEmbed.jsx
3. Test on Contact page
4. Document change

### Task 3: Add Another Map

**To display another campus:**

```jsx
// Create MapEmbed2.jsx
const MapEmbed2 = () => {
  return (
    <iframe
      src="NEW_LOCATION_EMBED_URL"
      width="100%"
      height="450"
      ...
    />
  );
};
export default MapEmbed2;
```

Then import and use in Contact.jsx:
```jsx
import MapEmbed2 from '../components/MapEmbed2';
// Use: <MapEmbed2 />
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Map not showing | Check browser console for errors |
| Wrong location | Get new embed code from Google Maps |
| Map too small | Increase height value in MapEmbed.jsx |
| Map cut off on mobile | Ensure width="100%" is set |
| Slow loading | Already has lazy loading enabled |
| CORS error | Not applicable - using embed iframe |

## Browser Support

| Browser | Support | Version |
|---------|---------|---------|
| Chrome | ✓ | 90+ |
| Firefox | ✓ | 88+ |
| Safari | ✓ | 14+ |
| Edge | ✓ | 90+ |
| Mobile Chrome | ✓ | Current |
| Mobile Safari | ✓ | Current |
| IE | ✗ | Not supported |

## Documentation Files

| File | Purpose |
|------|---------|
| `GOOGLE_MAPS_INTEGRATION_GUIDE.md` | How to get & configure embed codes |
| `GOOGLE_MAPS_SETUP_GUIDE.md` | Detailed setup & testing guide |
| `GOOGLE_MAPS_QUICK_REFERENCE.md` | This file - quick lookup |
| `CONTACT_US_IMPLEMENTATION.md` | Full contact feature documentation |

## Quick Links

- **View Map:** http://localhost:5173/contact (when dev server running)
- **Edit Component:** `frontend/src/components/MapEmbed.jsx`
- **Edit Integration:** `frontend/src/pages/Contact.jsx`
- **Get Embed Code:** https://www.google.com/maps
- **Issue Reports:** enyihefikiradis@gmail.com

## Performance

| Metric | Status |
|--------|--------|
| Lazy Loading | ✓ Enabled |
| Responsive | ✓ Yes |
| Mobile Ready | ✓ Yes |
| Accessible | ✓ Yes |
| Load Time | ✓ Fast |

## Version History

| Date | Change |
|------|--------|
| 2026-08-29 | Initial implementation |
| - | Map embed added to Contact page |
| - | Coordinates: 10.886480, 40.248944 |
| - | Location: Gimba, Ethiopia |

---

**Last Updated:** 2026-08-29  
**Status:** ✅ Production Ready  
**Questions?** Contact: enyihefikiradis@gmail.com
