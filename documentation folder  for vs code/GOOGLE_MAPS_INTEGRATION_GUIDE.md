# Google Maps Integration Guide - Mekdela Amba University

## Overview
The Contact Us page now includes an embedded Google Map showing the location of Mekdela Amba University in Gimba, Tulu Awuliya, Amhara Region, Ethiopia.

## Current Implementation

### Map Component Location
- **File:** `frontend/src/components/MapEmbed.jsx`
- **Integration:** Imported and used in `frontend/src/pages/Contact.jsx`

### Current Coordinates
- **Latitude:** 10.886480
- **Longitude:** 40.248944
- **Location:** Gimba, Tulu Awuliya, Amhara Region, Ethiopia

## How to Get the Correct Google Maps Embed Code

### Method 1: Using Google Maps Website (Recommended)

1. **Open Google Maps:**
   - Go to https://www.google.com/maps

2. **Search for the Location:**
   - Search for "Mekdela Amba University" or enter coordinates: 10.886480, 40.248944

3. **Get the Embed Code:**
   - Click the menu icon (≡) in the top-left
   - Select "Share or embed map"
   - Click "Embed a map" tab
   - Copy the embed code

4. **Update MapEmbed.jsx:**
   - Replace the `src` URL in the iframe with the new embed code URL

### Method 2: Using Coordinates URL

You can also use this format to create a custom Google Maps URL:

```
https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3938.1889064649993!2d40.248944!3d10.886480!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x16617aed0c8c2c81%3A0x1234567890ab!2sMekdela%20Amba%20University!5e0!3m2!1sen!2set!4v1693478901234
```

**Parameters:**
- `!3d10.886480` - Latitude
- `!2d40.248944` - Longitude
- `!1s0x16617aed0c8c2c81%3A0x1234567890ab` - Place ID (optional)

## File Locations

```
IPES/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── MapEmbed.jsx (NEW - Map component)
│   │   └── pages/
│   │       └── Contact.jsx (UPDATED - Map integration)
```

## Contact Page Map Section

The Contact page now includes:

### What's Displayed:
1. **"Find Us on the Map" Section**
   - Heading with blue styling
   - Descriptive subtitle
   - Embedded Google Map (450px height)
   - Campus address information
   - "View on Google Maps" link

### Map Features:
- Responsive design (100% width)
- Proper border and shadow styling
- Interactive zoom and pan controls
- Street view available (through Google Maps)
- Mobile-friendly

## Updating the Map

### To Change the Embed Code:

**Edit `frontend/src/components/MapEmbed.jsx`:**

```jsx
<iframe
  src="YOUR_NEW_EMBED_URL_HERE"  // ← Replace this line
  width="100%"
  height="450"
  style={{ border: 0 }}
  allowFullScreen=""
  loading="lazy"
  referrerPolicy="no-referrer-when-downgrade"
  title="Mekdela Amba University Location"
></iframe>
```

### To Change Map Height:

Modify the `height` property in the iframe (currently 450px):
```jsx
height="500"  // Increase to 500px
```

## Verification Steps

1. **Frontend Test:**
   - Navigate to Contact page
   - Verify map displays below contact form
   - Test map interactivity (zoom, pan, drag)
   - Check responsive design on mobile

2. **URL Test:**
   - Click "View on Google Maps" link
   - Verify it opens correct location in Google Maps

3. **Information Accuracy:**
   - Verify address: "Gimba, Tulu Awuliya, Amhara Region, Ethiopia"
   - Verify P.O. Box: "P.O. Box 32"
   - Verify coordinates point to correct campus location

## Troubleshooting

### Map Not Displaying
**Possible Causes:**
- Invalid embed URL
- Iframe sandbox restrictions
- Browser content blocking

**Solutions:**
1. Verify the `src` URL is correct
2. Check browser console for errors
3. Clear browser cache and refresh
4. Ensure iframe attributes are correct

### Map Shows Wrong Location
**Solution:**
1. Get new embed code from Google Maps
2. Verify coordinates: 10.886480, 40.248944
3. Update the embed URL in MapEmbed.jsx

### Map is Too Small/Large
**Solution:**
- Change the `height` property in the iframe
- Adjust width if needed (currently 100%)

## Advanced Customization

### Option 1: Add Custom Marker

You can modify the embed URL to include a custom marker:

```
https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3938.1889064649993!2d40.248944!3d10.886480!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x16617aed0c8c2c81%3A0x1234567890ab!2sMekdela%20Amba%20University!5e0!3m2!1sen!2set!4v1693478901234
```

### Option 2: Use React Google Maps Library

For more control, consider using `google-maps-react`:

```bash
npm install google-map-react
```

Then update MapEmbed.jsx to use the library for more customization options.

### Option 3: Multiple Locations

To show multiple campus locations on the map, you can:
1. Use a map library like Leaflet or Mapbox
2. Add multiple markers programmatically
3. Create a custom map component

## Best Practices

1. **Keep Coordinates Updated:** If campus location changes, update the coordinates
2. **Test Periodically:** Verify map still displays correctly
3. **Accessibility:** Provide alternative text and link to Google Maps
4. **Performance:** Use lazy loading (already implemented)
5. **Mobile Responsive:** Test on various screen sizes

## Documentation

For more information on Google Maps Embed API:
- Official Docs: https://developers.google.com/maps/documentation/embed/overview
- API Reference: https://developers.google.com/maps/documentation/embed/map-mode

## Support

For issues or questions about the map integration:
- Contact: enyihefikiradis@gmail.com
- Reference: IPES Contact Us feature implementation
