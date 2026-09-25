import { Router, Request, Response } from 'express';
import { regionService } from '../../services/region.service';

const router = Router();

// GET /api/public/zones/check-serviceability?lat=28.6139&lng=77.2090&pincode=110001
router.get('/check-serviceability', async (req: Request, res: Response) => {
  const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
  const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
  const pincode = req.query.pincode as string | undefined;

  if ((lat === undefined || isNaN(lat) || lng === undefined || isNaN(lng)) && (!pincode || pincode.trim().length < 6)) {
    return res.status(400).json({
      success: false,
      message: 'Either valid GPS coordinates (lat, lng) or a 6-digit pincode are required.',
    });
  }

  try {
    const result = await regionService.checkServiceability(lat, lng, pincode);
    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error checking serviceability:', error);
    res.status(500).json({ success: false, message: 'Failed to check serviceability.' });
  }
});

// GET /api/public/zones/check-pincode?pincode=123456
router.get('/check-pincode', async (req: Request, res: Response) => {
  const { pincode } = req.query;

  if (!pincode || typeof pincode !== 'string') {
    return res.status(400).json({ success: false, message: 'Valid pincode is required.' });
  }

  try {
    const result = await regionService.checkServiceability(undefined, undefined, pincode);
    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error verifying pincode:', error);
    res.status(500).json({ success: false, message: 'Failed to verify pincode.' });
  }
});

// GET /api/public/zones/regions
router.get('/regions', async (req: Request, res: Response) => {
  try {
    const regions = await regionService.getActiveRegions();
    return res.json({
      success: true,
      data: regions,
    });
  } catch (error: any) {
    console.error('Error fetching regions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch regions.' });
  }
});

export default router;
