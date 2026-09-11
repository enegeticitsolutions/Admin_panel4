import { Router, Request, Response, NextFunction } from 'express';
import { ApiError } from '../../utils/ApiError';

const router = Router();

// Middleware to restrict access to only our mobile apps (and website if it knows the secret)
const requireAppSecret = (req: Request, res: Response, next: NextFunction) => {
  const secret = req.headers['x-app-secret'];
  const allowedSecrets = [
    process.env.MHN_APP_SECRET,
    process.env.EXPO_PUBLIC_APP_SECRET,
    'MaiHoonNaSecureApp2026!',
    'mhn-mobile-app-secret-2024',
    'mhn-staging-app-secret-2026',
  ].filter(Boolean);

  if (!secret || !allowedSecrets.includes(secret as string)) {
    return next(new ApiError(403, 'Forbidden: Invalid App Secret'));
  }
  next();
};

router.use(requireAppSecret);

router.get('/reverse-geocode', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      throw new ApiError(400, 'Latitude and longitude are required');
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new ApiError(500, 'Google Maps API key is not configured on the server');
    }

    // Using native fetch which is available in Node 18+
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`);
    const data = await response.json();

    if (data.status !== 'OK') {
       return res.status(400).json({ success: false, message: 'Geocoding failed', details: data });
    }

    // Extract relevant parts
    const result = data.results[0];
    const address = result.formatted_address;
    
    // Extract city, state, pincode from address_components across all results
    let city = '', state = '', pincode = '';
    
    for (const res of data.results) {
      if (res.address_components) {
        res.address_components.forEach((comp: any) => {
            if (!city && comp.types.includes('locality')) city = comp.long_name;
            if (!state && comp.types.includes('administrative_area_level_1')) state = comp.long_name;
            if (!pincode && comp.types.includes('postal_code')) pincode = comp.long_name;
        });
      }
      // Stop searching once we have all three
      if (city && state && pincode) break;
    }

    res.json({
      success: true,
      data: {
        address,
        city,
        state,
        pincode,
        lat: parseFloat(lat as string),
        lng: parseFloat(lng as string)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/geocode', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.query;
    if (!address || typeof address !== 'string') {
      throw new ApiError(400, 'Address query parameter is required');
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new ApiError(500, 'Google Maps API key is not configured on the server');
    }

    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`);
    const data = await response.json();

    if (data.status !== 'OK') {
       return res.status(400).json({ success: false, message: 'Geocoding failed', details: data });
    }

    const result = data.results[0];
    const location = result.geometry.location;

    // Extract city, state, pincode from address_components
    let city = '', state = '', pincode = '';
    if (result.address_components) {
      result.address_components.forEach((comp: any) => {
          if (comp.types.includes('locality')) city = comp.long_name;
          if (comp.types.includes('administrative_area_level_1')) state = comp.long_name;
          if (comp.types.includes('postal_code')) pincode = comp.long_name;
      });
    }

    res.json({
      success: true,
      data: {
        address: result.formatted_address,
        city,
        state,
        pincode,
        lat: location.lat,
        lng: location.lng
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/autocomplete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { input } = req.query;
    if (!input || typeof input !== 'string') {
      throw new ApiError(400, 'Input query parameter is required');
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new ApiError(500, 'Google Maps API key is not configured on the server');
    }

    const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}&components=country:in`);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
       return res.status(400).json({ success: false, message: 'Autocomplete failed', details: data });
    }

    const suggestions = (data.predictions || []).map((pred: any) => ({
      description: pred.description,
      placeId: pred.place_id
    }));

    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    next(error);
  }
});

router.get('/place-details', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { placeId } = req.query;
    if (!placeId || typeof placeId !== 'string') {
      throw new ApiError(400, 'placeId query parameter is required');
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new ApiError(500, 'Google Maps API key is not configured on the server');
    }

    const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,address_components,formatted_address&key=${apiKey}`);
    const data = await response.json();

    if (data.status !== 'OK') {
       return res.status(400).json({ success: false, message: 'Place details retrieval failed', details: data });
    }

    const result = data.result;
    const location = result.geometry.location;

    // Extract city, state, pincode, flatPlot, streetArea
    let city = '', state = '', pincode = '', flatPlot = '', streetArea = '';
    if (result.address_components) {
      const sublocalities: string[] = [];
      let route = '';

      result.address_components.forEach((comp: any) => {
          if (comp.types.includes('locality')) city = comp.long_name;
          if (comp.types.includes('administrative_area_level_1')) state = comp.long_name;
          if (comp.types.includes('postal_code')) pincode = comp.long_name;
          
          if (comp.types.includes('premise') || comp.types.includes('subpremise') || comp.types.includes('street_number')) {
            flatPlot = flatPlot ? `${flatPlot}, ${comp.long_name}` : comp.long_name;
          }
          if (comp.types.includes('route')) route = comp.long_name;
          if (comp.types.includes('sublocality') || comp.types.includes('neighborhood') || comp.types.includes('sublocality_level_1') || comp.types.includes('sublocality_level_2')) {
            sublocalities.push(comp.long_name);
          }
      });
      
      // Combine route and sublocalities for streetArea
      const streetParts = [];
      if (route) streetParts.push(route);
      if (sublocalities.length > 0) streetParts.push(...sublocalities);
      
      // Deduplicate parts to avoid "Sector 53, Sector 53"
      streetArea = [...new Set(streetParts)].join(', ');
    }

    res.json({
      success: true,
      data: {
        address: result.formatted_address,
        flatPlot,
        streetArea,
        city,
        state,
        pincode,
        lat: location.lat,
        lng: location.lng
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
