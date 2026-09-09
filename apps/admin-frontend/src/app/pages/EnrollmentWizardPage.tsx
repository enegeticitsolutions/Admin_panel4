/**
 * Enrollment Wizard — Admin-side subscriber + beneficiary onboarding
 * 5-step wizard: Subscriber → Beneficiary → Package → Payment → Confirm
 */

import React, { useEffect, useRef, useState } from 'react';
import { sanitizeImgSrc } from '../utils/sanitizeUrl';
import { useNavigate } from 'react-router';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { enrollmentApi, subscriptionApi, packageApi, staffOnboardingApi, vitalApi, hobbyApi, paymentApi } from '../../services/api';
import { PaymentMethodSelector } from '../components/payment/PaymentMethodSelector';
import { toast } from 'sonner';
import { AddonBenefitModal } from '../components/addons/AddonBenefitModal';
import { InvoiceViewModal } from '../components/InvoiceViewModal';
import {
  UserPlus, ArrowLeft, ArrowRight, Check, Phone, User, Package,
  CreditCard, CheckCircle2, Loader2, AlertCircle, Users,
  Info, Calendar, Activity, ShieldAlert, Plus, Trash2, HeartPulse,
  Mail, MapPin, Camera, UserSquare, Stethoscope, Heart, Building, X, Clock,
  Printer,
} from 'lucide-react';
import { PincodeCheck } from '../components/enrollment/PincodeCheck';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '../components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';

type Step = 'subscriber' | 'beneficiary' | 'medical' | 'emergency' | 'package' | 'payment' | 'confirm';


const STEPS: { id: Step; label: string; icon: React.ElementType }[] = [
  { id: 'subscriber', label: 'Subscriber', icon: User },
  { id: 'beneficiary', label: 'Beneficiary', icon: UserSquare },
  { id: 'medical', label: 'Medical & Life', icon: Stethoscope },
  { id: 'emergency', label: 'Emergency', icon: ShieldAlert },
  { id: 'package', label: 'Plan & Timing', icon: Package },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'confirm', label: 'Confirm', icon: Check },
];

import { DURATION_OPTIONS, calculateWizardPricing } from '../utils/pricing';

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'UPI', 'NEFT/RTGS', 'Other'];

const COMMON_HOBBIES = [
  'Reading', 'Gardening', 'Yoga', 'Walking', 'Cooking', 'Music', 'Movies',
  'Traveling', 'Painting', 'Meditation', 'Sudoku/Puzzles', 'Socializing',
  'Crafting', 'Photography', 'Writing', 'Sports', 'Other'
];

const RELATIONSHIPS = [
  'Father', 'Mother', 'Spouse', 'Son', 'Daughter', 'Sibling', 
  'Grandparent', 'Father-in-law', 'Mother-in-law', 'Relative', 'Friend', 'Other'
];

export default function EnrollmentWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('subscriber');
  const [enrolling, setEnrolling] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [enrolledResult, setEnrolledResult] = useState<any>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const [enrollingMode, setEnrollingMode] = useState<'new' | 'existing'>('existing');
  const [existingSubscriberId, setExistingSubscriberId] = useState('');

  // ── Subscriber
  const [subscriberPhone, setSubscriberPhone] = useState('');
  const [subscriberName, setSubscriberName] = useState('');
  const [subscriberEmail, setSubscriberEmail] = useState('');
  const [subscriberAddress, setSubscriberAddress] = useState('');
  const [subscriberPincode, setSubscriberPincode] = useState('');
  const [subscriberCity, setSubscriberCity] = useState('');
  const [subscriberState, setSubscriberState] = useState('');
  const [subscriberPassword, setSubscriberPassword] = useState('');
  const [phoneChecking, setPhoneChecking] = useState(false);
  const [phoneCheck, setPhoneCheck] = useState<{ exists: boolean; id?: string; name?: string; beneficiaries?: any[] } | null>(null);
  const phoneDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Beneficiary
  const [sameAsSubscriber, setSameAsSubscriber] = useState(false);
  const [beneficiaryPhone, setBeneficiaryPhone] = useState('');
  const [benPhoneChecking, setBenPhoneChecking] = useState(false);
  const [benPhoneCheck, setBenPhoneCheck] = useState<{ exists: boolean; name?: string } | null>(null);
  const benPhoneDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryAge, setBeneficiaryAge] = useState('');
  const [beneficiaryDob, setBeneficiaryDob] = useState('');
  const [beneficiaryGender, setBeneficiaryGender] = useState('prefer_not_to_say');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [beneficiaryAddress, setBeneficiaryAddress] = useState('');
  const [beneficiaryPincode, setBeneficiaryPincode] = useState('');
  const [beneficiaryCity, setBeneficiaryCity] = useState('');
  const [beneficiaryState, setBeneficiaryState] = useState('');
  const [relationship, setRelationship] = useState('');

  // ── Medical & Vitals
  const [medicalConditions, setMedicalConditions] = useState<string[]>([]); 
  const [medications, setMedications] = useState<any[]>([]); // { name, dosage, frequency, timeSlots, setReminders }
  const [vitalsToTrack, setVitalsToTrack] = useState<Record<string, boolean>>({});
  const [availableVitals, setAvailableVitals] = useState<any[]>([]);
  const [loadingVitals, setLoadingVitals] = useState(false);
  const [primaryPhysicianName, setPrimaryPhysicianName] = useState('');
  const [primaryPhysicianPhone, setPrimaryPhysicianPhone] = useState('');
  const [hobbiesInterests, setHobbiesInterests] = useState<string[]>([]);
  const [customHobby, setCustomHobby] = useState('');
  const [dbHobbies, setDbHobbies] = useState<string[]>(COMMON_HOBBIES);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Emergency Contacts
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [emergencyContactRel, setEmergencyContactRel] = useState('Family');
  const [emergencyContactEmail, setEmergencyContactEmail] = useState('');

  const [secondaryContactName, setSecondaryContactName] = useState('');
  const [secondaryContactPhone, setSecondaryContactPhone] = useState('');
  const [secondaryContactRel, setSecondaryContactRel] = useState('');
  const [secondaryContactEmail, setSecondaryContactEmail] = useState('');

  // ── Schedule
  const [preferredSlot, setPreferredSlot] = useState('Morning');

  // ── Package
  const [packages, setPackages] = useState<any[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [duration, setDuration] = useState('monthly');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);

  // ── Payment
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [paymentMode, setPaymentMode] = useState<'offline' | 'online_link'>('offline');
  const [paymentLinkDetailsState, setPaymentLinkDetailsState] = useState<any>(() => {
    try {
      const saved = sessionStorage.getItem('enrollment_payment_link_details');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setPaymentLinkDetails = (data: any) => {
    setPaymentLinkDetailsState(data);
    if (data) {
      sessionStorage.setItem('enrollment_payment_link_details', JSON.stringify(data));
    } else {
      sessionStorage.removeItem('enrollment_payment_link_details');
    }
  };

  const paymentLinkDetails = paymentLinkDetailsState;
  const [generatingLink, setGeneratingLink] = useState(false);

  // ── Add-on Benefits State
  const [selectedAddons, setSelectedAddons] = useState<any[]>([]);
  const [isAddonModalOpen, setIsAddonModalOpen] = useState(false);

  // ── Authoritative Server Pricing
  const [serverPricing, setServerPricing] = useState<any>(null);
  const [calculatingPrice, setCalculatingPrice] = useState(false);

  // ── Add Medicine Dialog State
  const [isMedDialogOpen, setIsMedDialogOpen] = useState(false);
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medFrequency, setMedFrequency] = useState('once_daily');
  const [medSlots, setMedSlots] = useState<string[]>(['morning']);
  const [medInstructions, setMedInstructions] = useState('');
  const [medStartDate, setMedStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [medEndDate, setMedEndDate] = useState('');
  const [medReminders, setMedReminders] = useState(false);

  const handleFrequencyChange = (value: string) => {
    setMedFrequency(value);
    if (value === 'once_daily') {
      setMedSlots(prev => prev.length > 0 ? [prev[0]] : ['morning']);
    } else if (value === 'twice_daily') {
      setMedSlots(prev => {
        if (prev.length === 2) return prev;
        if (prev.length === 3) return [prev[0], prev[1]];
        if (prev.length === 1) {
          const remaining = ['morning', 'evening', 'afternoon'].filter(s => s !== prev[0]);
          return [prev[0], remaining[0]];
        }
        return ['morning', 'evening'];
      });
    } else if (value === 'thrice_daily') {
      setMedSlots(['morning', 'afternoon', 'evening']);
    }
  };

  const handleSlotToggle = (slot: string) => {
    const times = medSlots;
    const freq = medFrequency;
    
    let maxSlots = 3;
    if (freq === 'once_daily') maxSlots = 1;
    else if (freq === 'twice_daily') maxSlots = 2;

    if (times.includes(slot)) {
      setMedSlots(times.filter(t => t !== slot));
    } else {
      if (times.length >= maxSlots) {
        if (maxSlots === 1) {
          setMedSlots([slot]);
        } else {
          setMedSlots([...times.slice(1), slot]);
        }
      } else {
        setMedSlots([...times, slot]);
      }
    }
  };

  // ── Persistence Logic
  useEffect(() => {
    const saved = sessionStorage.getItem('enrollment_wizard_data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.step) setStep(data.step);
        if (data.subscriberPhone) setSubscriberPhone(data.subscriberPhone);
        if (data.subscriberName) setSubscriberName(data.subscriberName);
        if (data.subscriberEmail) setSubscriberEmail(data.subscriberEmail);
        if (data.subscriberAddress) setSubscriberAddress(data.subscriberAddress);
        if (data.subscriberPincode) setSubscriberPincode(data.subscriberPincode);
        if (data.subscriberCity) setSubscriberCity(data.subscriberCity);
        if (data.subscriberState) setSubscriberState(data.subscriberState);
        if (data.subscriberPassword) setSubscriberPassword(data.subscriberPassword);
        if (data.sameAsSubscriber !== undefined) setSameAsSubscriber(data.sameAsSubscriber);
        if (data.beneficiaryPhone) setBeneficiaryPhone(data.beneficiaryPhone);
        if (data.beneficiaryName) setBeneficiaryName(data.beneficiaryName);
        if (data.beneficiaryAge) setBeneficiaryAge(data.beneficiaryAge);
        if (data.beneficiaryDob) setBeneficiaryDob(data.beneficiaryDob);
        if (data.beneficiaryGender) setBeneficiaryGender(data.beneficiaryGender);
        if (data.maritalStatus) setMaritalStatus(data.maritalStatus);
        if (data.profilePhoto) setProfilePhoto(data.profilePhoto);
        if (data.beneficiaryAddress) setBeneficiaryAddress(data.beneficiaryAddress);
        if (data.beneficiaryPincode) setBeneficiaryPincode(data.beneficiaryPincode);
        if (data.beneficiaryCity) setBeneficiaryCity(data.beneficiaryCity);
        if (data.beneficiaryState) setBeneficiaryState(data.beneficiaryState);
        if (data.relationship) setRelationship(data.relationship);
        if (data.medicalConditions) setMedicalConditions(data.medicalConditions);
        if (data.medications) setMedications(data.medications);
        if (data.vitalsToTrack) setVitalsToTrack(data.vitalsToTrack);
        if (data.primaryPhysicianName) setPrimaryPhysicianName(data.primaryPhysicianName);
        if (data.primaryPhysicianPhone) setPrimaryPhysicianPhone(data.primaryPhysicianPhone);
        if (data.hobbiesInterests) setHobbiesInterests(data.hobbiesInterests);
        if (data.customHobby) setCustomHobby(data.customHobby);
        if (data.emergencyContactName) setEmergencyContactName(data.emergencyContactName);
        if (data.emergencyContactPhone) setEmergencyContactPhone(data.emergencyContactPhone);
        if (data.emergencyContactRel) setEmergencyContactRel(data.emergencyContactRel);
        if (data.emergencyContactEmail) setEmergencyContactEmail(data.emergencyContactEmail);
        if (data.secondaryContactName) setSecondaryContactName(data.secondaryContactName);
        if (data.secondaryContactPhone) setSecondaryContactPhone(data.secondaryContactPhone);
        if (data.secondaryContactRel) setSecondaryContactRel(data.secondaryContactRel);
        if (data.secondaryContactEmail) setSecondaryContactEmail(data.secondaryContactEmail);
        if (data.preferredSlot) setPreferredSlot(data.preferredSlot);
        if (data.selectedPackageId) setSelectedPackageId(data.selectedPackageId);
        if (data.duration) setDuration(data.duration);
        if (data.startDate) setStartDate(data.startDate);
        if (data.amountPaid) setAmountPaid(data.amountPaid);
        if (data.paymentMethod) setPaymentMethod(data.paymentMethod);
        if (data.paymentNote) setPaymentNote(data.paymentNote);
      } catch (e) {
        console.warn('Failed to load saved enrollment data', e);
      }
    }
  }, []);

  useEffect(() => {
    if (step === 'confirm') return; // Don't save if already confirmed
    const data = {
      step, subscriberPhone, subscriberName, subscriberEmail, subscriberAddress, subscriberPincode, subscriberCity, subscriberState, subscriberPassword,
      sameAsSubscriber, beneficiaryPhone, beneficiaryName, beneficiaryAge, beneficiaryDob, beneficiaryGender, maritalStatus, profilePhoto,
      beneficiaryAddress, beneficiaryPincode, beneficiaryCity, beneficiaryState, relationship, medicalConditions, medications, vitalsToTrack,
      primaryPhysicianName, primaryPhysicianPhone, hobbiesInterests, customHobby, emergencyContactName, emergencyContactPhone, emergencyContactRel,
      emergencyContactEmail, secondaryContactName, secondaryContactPhone, secondaryContactRel, secondaryContactEmail, preferredSlot,
      selectedPackageId, duration, startDate, amountPaid, paymentMethod, paymentNote
    };
    sessionStorage.setItem('enrollment_wizard_data', JSON.stringify(data));
  }, [
    step, subscriberPhone, subscriberName, subscriberEmail, subscriberAddress, subscriberPincode, subscriberCity, subscriberState, subscriberPassword,
    sameAsSubscriber, beneficiaryPhone, beneficiaryName, beneficiaryAge, beneficiaryDob, beneficiaryGender, maritalStatus, profilePhoto,
    beneficiaryAddress, beneficiaryPincode, beneficiaryCity, beneficiaryState, relationship, medicalConditions, medications, vitalsToTrack,
    primaryPhysicianName, primaryPhysicianPhone, hobbiesInterests, customHobby, emergencyContactName, emergencyContactPhone, emergencyContactRel,
    emergencyContactEmail, secondaryContactName, secondaryContactPhone, secondaryContactRel, secondaryContactEmail, preferredSlot,
    selectedPackageId, duration, startDate, amountPaid, paymentMethod, paymentNote
  ]);

  const stepIndex = STEPS.findIndex(s => s.id === step);
  const selectedPackage = packages.find(p => p.id === selectedPackageId);

  const getSuggestedEndDate = (startStr: string, dur: string): string => {
    if (!startStr) return '';
    try {
      const date = new Date(startStr);
      if (isNaN(date.getTime())) return '';
      
      const opt = DURATION_OPTIONS.find(d => d.value === dur);
      const months = opt ? opt.months : 1;
      
      date.setMonth(date.getMonth() + months);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    } catch (e) {
      return '';
    }
  };

  useEffect(() => {
    packageApi.getAll().then(setPackages).catch(() => toast.error('Failed to load packages'));
    
    setLoadingVitals(true);
    vitalApi.getAll({ activeOnly: true })
      .then(vitals => {
        setAvailableVitals(vitals);
        const initialVitals: Record<string, boolean> = {};
        vitals.forEach(v => {
          initialVitals[v.code] = false; // Default all to false (unchecked by default)
        });
        setVitalsToTrack(initialVitals);
      })
      .catch(() => toast.error('Failed to load vitals'))
      .finally(() => setLoadingVitals(false));

    hobbyApi.getAll({ activeOnly: true })
      .then(hobbies => {
        if (hobbies && hobbies.length > 0) {
          const names = hobbies.map((h: any) => h.name);
          const hasOther = names.includes('Other');
          const sorted = [...names.filter((n: string) => n !== 'Other')];
          if (hasOther) sorted.push('Other');
          setDbHobbies(sorted);
        }
      })
      .catch(() => console.error('Failed to load hobbies from backend, using fallback list'));
  }, []);

  // Authoritative server-side price & tax calculation
  useEffect(() => {
    if (!selectedPackage) {
      setServerPricing(null);
      return;
    }
    let isMounted = true;
    setCalculatingPrice(true);
    const customerState = sameAsSubscriber ? subscriberState : (beneficiaryState || subscriberState || 'Haryana');
    subscriptionApi.calculatePrice({
      packageId: selectedPackage.id,
      duration,
      addons: selectedAddons.map(a => ({
        benefitId: a.benefit.id,
        units: a.units,
        totalAmount: a.totalAmount,
      })),
      customerState: customerState || 'Haryana',
    })
      .then(p => {
        if (isMounted) {
          setServerPricing(p);
          setAmountPaid(String(p.finalTotalAmount));
        }
      })
      .catch(err => {
        console.error('Server pricing error:', err);
        const local = calculateWizardPricing(selectedPackage, duration, selectedAddons, customerState);
        if (isMounted) {
          setServerPricing(local);
          setAmountPaid(String(local.finalTotalAmount));
        }
      })
      .finally(() => {
        if (isMounted) setCalculatingPrice(false);
      });

    return () => { isMounted = false; };
  }, [selectedPackage, duration, selectedAddons, beneficiaryState, subscriberState, sameAsSubscriber]);

  // Phone debounce check
  useEffect(() => {
    if (subscriberPhone.length < 10) {
      setPhoneCheck(null);
      return;
    }
    if (phoneDebounce.current) clearTimeout(phoneDebounce.current);
    phoneDebounce.current = setTimeout(async () => {
      setPhoneChecking(true);
      try {
        const data = await enrollmentApi.checkPhone(subscriberPhone);
        setPhoneCheck(data);
        if (data.exists && data.name) {
          setSubscriberName(data.name);
          if (data.id) setExistingSubscriberId(data.id);
        }
      } catch {
        setPhoneCheck(null);
      } finally {
        setPhoneChecking(false);
      }
    }, 600);
  }, [subscriberPhone]);

  // Beneficiary phone debounce check
  useEffect(() => {
    if (sameAsSubscriber || beneficiaryPhone.length < 10) {
      setBenPhoneCheck(null);
      return;
    }
    if (beneficiaryPhone === subscriberPhone) {
      setBenPhoneCheck({ exists: true, name: 'Same as Subscriber' });
      return;
    }
    if (benPhoneDebounce.current) clearTimeout(benPhoneDebounce.current);
    benPhoneDebounce.current = setTimeout(async () => {
      setBenPhoneChecking(true);
      try {
        const data = await enrollmentApi.checkPhone(beneficiaryPhone);
        setBenPhoneCheck(data);
      } catch {
        setBenPhoneCheck(null);
      } finally {
        setBenPhoneChecking(false);
      }
    }, 600);
  }, [beneficiaryPhone, sameAsSubscriber, subscriberPhone]);


  const goNext = () => {
    const nextIndex = Math.min(STEPS.length - 1, stepIndex + 1);
    setStep(STEPS[nextIndex].id);
  };

  const goBack = () => {
    if (stepIndex === 0) return navigate(-1);
    const prevIndex = Math.max(0, stepIndex - 1);
    setStep(STEPS[prevIndex].id);
  };

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const result = await enrollmentApi.adminEnroll({
        subscriberPhone,
        subscriberName,
        subscriberEmail,
        subscriberAddress,
        subscriberPincode,
        subscriberCity,
        subscriberState,
        sameAsSubscriber,
        beneficiaryPhone,
        beneficiaryName,
        beneficiaryAge: parseInt(beneficiaryAge) || 0,
        beneficiaryDob,
        beneficiaryGender,
        maritalStatus,
        profilePhoto,
        beneficiaryAddress,
        beneficiaryPincode,
        beneficiaryCity,
        beneficiaryState,
        relationship,
        medicalConditions,
        medications,
        vitalsToTrack,
        primaryPhysicianName,
        primaryPhysicianPhone,
        hobbiesInterests: hobbiesInterests.includes('Other') && customHobby 
          ? [...hobbiesInterests.filter(h => h !== 'Other'), customHobby]
          : hobbiesInterests,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelationship: emergencyContactRel,
        emergencyContactEmail,
        secondaryContactName,
        secondaryContactPhone,
        secondaryContactRelationship: secondaryContactRel,
        secondaryContactEmail,
        preferredSlot,
        packageId: selectedPackageId,
        duration,
        startDate,
        amountPaid: parseFloat(amountPaid) || 0,
        paymentMethod,
        paymentNote,
        csaMode: true, // Always CSA mode from admin — subscriber activates via app
        subscriberPassword: subscriberPassword || undefined,
      });
      // Allocate any selected add-ons
      const subId = result?.subscription?.id || (result as any)?.id || (result as any)?.data?.subscription?.id;
      if (subId && selectedAddons.length > 0) {
        for (const addon of selectedAddons) {
          await subscriptionApi.allocateAddon(subId, {
            benefitId: addon.benefit.id,
            units: addon.units,
            amountPaid: addon.totalAmount,
            paymentMethod,
            paymentNote: `Enrollment Add-on: ${addon.benefit.name}`,
          }).catch(e => console.warn('Addon allocation warning on enroll:', e));
        }
      }

      setEnrolledResult(result);
      setStep('confirm');
      sessionStorage.removeItem('enrollment_wizard_data');
      toast.success('Enrollment successful! ✅');
    } catch (err: any) {
      toast.error(err.message || 'Enrollment failed');
    } finally {
      setEnrolling(false);
    }
  };

  // In existing-subscriber mode, we only need phone match; in new mode we need name too
  const canProceedSubscriber = enrollingMode === 'existing'
    ? subscriberPhone.length >= 10 && phoneCheck?.exists === true
    : subscriberPhone.length >= 10 && subscriberName.trim().length > 0;
  const canProceedBeneficiary = sameAsSubscriber
    ? true
    : beneficiaryName.trim().length > 0 &&
      beneficiaryPhone.length === 10 &&
      beneficiaryPhone !== subscriberPhone &&
      benPhoneCheck?.exists !== true;
  const canProceedMedical = true; // Medical is optional as per user request
  const canProceedEmergency = emergencyContactName.trim().length > 0 && emergencyContactPhone.length >= 10;
  const canProceedPackage = !!selectedPackageId;
  const canProceedPayment = !!amountPaid && parseFloat(amountPaid) >= 0;

  const pricing = serverPricing || calculateWizardPricing(selectedPackage, duration, selectedAddons, sameAsSubscriber ? subscriberState : (beneficiaryState || subscriberState));

  const endDate = (() => {
    if (!startDate) return '';
    const d = new Date(startDate);
    if (duration === 'three_months') d.setMonth(d.getMonth() + 3);
    else if (duration === 'six_months') d.setMonth(d.getMonth() + 6);
    else if (duration === 'annual') d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  })();

  if (step === 'confirm' && enrolledResult) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Enrollment Complete!</h1>
        <p className="text-muted-foreground mb-8">The subscriber has been successfully enrolled in the package.</p>

        <Card className="mb-6 text-left">
          <CardContent className="p-5 space-y-3">
            <div className="flex justify-between items-center text-sm bg-orange-50/50 p-2.5 rounded-xl border border-orange-100">
              <div>
                <span className="text-muted-foreground text-xs block font-semibold">Statutory GST Invoice</span>
                <span className="font-bold font-mono text-[#FF7A00] text-sm">{enrolledResult.invoiceNumber}</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowInvoiceModal(true)}
                className="h-8 border-[#FF7A00]/40 text-[#FF7A00] hover:bg-[#FF7A00] hover:text-white font-bold text-xs gap-1.5 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                View &amp; Print Invoice
              </Button>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subscriber</span>
              <span className="font-semibold">{enrolledResult.subscriber?.name} ({enrolledResult.subscriber?.phone})</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-dashed mb-2">
              <div className="flex items-center gap-3">
                {profilePhoto ? (
                  <img src={sanitizeImgSrc(profilePhoto)} alt="Beneficiary" className="w-12 h-12 rounded-full object-cover border-2 border-primary/20" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                    <UserSquare className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground text-xs block uppercase font-bold tracking-tighter">Beneficiary</span>
                  <span className="font-bold text-lg leading-none">{enrolledResult.beneficiary?.name}</span>
                </div>
              </div>
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                {relationship || 'Self'}
              </Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Package</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{enrolledResult.package?.name}</span>
                {enrolledResult.package && (
                  <Badge 
                    variant="secondary" 
                    className={`text-[8px] uppercase px-1 h-3.5 border-none ${
                      enrolledResult.package.isGlobal 
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' 
                        : enrolledResult.package.regions && enrolledResult.package.regions.length > 0
                        ? 'bg-[#FFE6D5] text-[#FF7A00] hover:bg-[#FFE6D5]'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {enrolledResult.package.isGlobal ? 'Global' : enrolledResult.package.regions && enrolledResult.package.regions.length > 0 ? 'Region Based' : 'Private'}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex justify-between text-sm border-t pt-3">
              <span className="text-muted-foreground">Amount Collected</span>
              <span className="font-bold text-green-700">₹{amountPaid} <span className="font-normal text-muted-foreground">via {paymentMethod}</span></span>
            </div>
          </CardContent>
        </Card>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 mb-8 flex gap-2 items-start">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            The subscriber can log in to the app using <strong>{subscriberPhone}</strong> via OTP and their package will appear automatically.
          </span>
        </div>

        <div className="flex gap-3 justify-center">
          <Button onClick={() => navigate('/subscribers')} variant="outline">
            <Users className="w-4 h-4 mr-2" /> View Subscribers
          </Button>
          <Button onClick={() => { setStep('subscriber'); setEnrolledResult(null); setSubscriberPhone(''); setSubscriberName(''); setPhoneCheck(null); setSelectedPackageId(''); setAmountPaid(''); setBeneficiaryName(''); setBeneficiaryPhone(''); setSameAsSubscriber(false); }} className="bg-primary">
            <UserPlus className="w-4 h-4 mr-2" /> Enroll Another
          </Button>
        </div>

        {/* Statutory Invoice Modal */}
        <InvoiceViewModal
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          invoiceId={enrolledResult.invoiceId || enrolledResult.invoiceNumber}
        />
      </div>
    );
  }

  return (
    <div className="pb-20">
      <PageHeader
        title="Enroll Subscriber"
        description="Onboard a new subscriber and beneficiary to a care package"
        action={
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        }
      />

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center gap-0">
          {STEPS.filter(s => s.id !== 'confirm').map((s, i) => {
            const Icon = s.icon;
            const isActive = s.id === step;
            const isDone = stepIndex > i;
            return (
              <React.Fragment key={s.id}>
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    isDone ? 'bg-green-500 border-green-500 text-white'
                    : isActive ? 'bg-primary border-primary text-white'
                    : 'bg-card border-border text-muted-foreground'
                  }`}>
                    {isDone ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={`text-xs mt-1 font-medium ${isActive ? 'text-primary' : isDone ? 'text-green-600' : 'text-muted-foreground'}`}>{s.label}</span>
                </div>
                {i < STEPS.length - 2 && (
                  <div className={`h-0.5 flex-1 mx-1 mb-4 ${isDone ? 'bg-green-400' : 'bg-border'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* ── Step 1: Subscriber ── */}
        {step === 'subscriber' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="w-5 h-5 text-primary" /> Subscriber Information</CardTitle>
              <CardDescription>The person responsible for the account and payments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* ── Enrollment Mode Toggle ── */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
                <button
                  type="button"
                  onClick={() => { setEnrollingMode('existing'); setSubscriberPhone(''); setPhoneCheck(null); setSubscriberName(''); }}
                  className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                    enrollingMode === 'existing'
                      ? 'bg-primary text-white shadow'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Phone className="w-4 h-4" />
                  App User (Case 1)
                </button>
                <button
                  type="button"
                  onClick={() => { setEnrollingMode('new'); setSubscriberPhone(''); setPhoneCheck(null); setSubscriberName(''); }}
                  className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                    enrollingMode === 'new'
                      ? 'bg-primary text-white shadow'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  Direct Call (Case 2)
                </button>
              </div>

              {/* ── Mode Description ── */}
              <div className={`rounded-xl p-3 text-sm flex gap-2 items-start ${enrollingMode === 'existing' ? 'bg-blue-50 border border-blue-200 text-blue-800' : 'bg-orange-50 border border-orange-200 text-orange-800'}`}>
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  {enrollingMode === 'existing'
                    ? <><strong>App User:</strong> Subscriber already downloaded the app. Search by their phone number to find their account, then enroll a beneficiary on their behalf.</>
                    : <><strong>Direct Call:</strong> New user who called directly. Fill in their subscriber details from scratch. A new account will be created for them.</>}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Phone — always shown first */}
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label htmlFor="sub-phone">
                    {enrollingMode === 'existing' ? 'Search by Phone *' : 'Phone Number *'}
                  </Label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="sub-phone"
                      value={subscriberPhone}
                      onChange={e => setSubscriberPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder={enrollingMode === 'existing' ? 'Enter subscriber\'s phone to search' : '10-digit mobile number'}
                      className="pl-9"
                      maxLength={10}
                    />
                    {phoneChecking && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3 text-muted-foreground" />}
                  </div>
                </div>

                {/* Name: locked for existing mode when found, editable for new */}
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label htmlFor="sub-name">Full Name {enrollingMode === 'new' && '*'}</Label>
                  <Input
                    id="sub-name"
                    value={subscriberName}
                    onChange={e => enrollingMode === 'new' && setSubscriberName(e.target.value)}
                    placeholder={enrollingMode === 'existing' ? 'Auto-filled from account' : 'e.g. Sumit Kejriwal'}
                    readOnly={enrollingMode === 'existing'}
                    className={enrollingMode === 'existing' ? 'bg-muted text-muted-foreground cursor-not-allowed' : ''}
                  />
                </div>

                {/* Phone status banner */}
                {phoneCheck && (
                  <div className={`col-span-2 flex items-start gap-2 text-xs px-3 py-2.5 rounded-xl border ${
                    phoneCheck.exists
                      ? 'bg-green-50 text-green-800 border-green-200'
                      : enrollingMode === 'existing'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-green-50 text-green-700 border-green-200'
                  }`}>
                    {phoneCheck.exists ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong>Subscriber found: {phoneCheck.name}</strong>
                          <span className="block mt-0.5 text-green-700">
                            {phoneCheck.beneficiaries?.length || 0} beneficiar{(phoneCheck.beneficiaries?.length || 0) === 1 ? 'y' : 'ies'} already enrolled. You can add another.
                          </span>
                        </div>
                      </>
                    ) : enrollingMode === 'existing' ? (
                      <>
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>No subscriber found with this phone. Switch to <strong>Direct Call</strong> to create a new account.</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>New phone — a fresh subscriber account will be created.</span>
                      </>
                    )}
                  </div>
                )}

                {/* Extra fields: only shown for New mode (Case 2) */}
                {enrollingMode === 'new' && (
                  <>
                    <div className="space-y-1 col-span-2">
                      <Label htmlFor="sub-email">Email Address</Label>
                      <div className="relative">
                        <Mail className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                        <Input
                          id="sub-email"
                          value={subscriberEmail}
                          onChange={e => setSubscriberEmail(e.target.value)}
                          placeholder="your@email.com"
                          className="pl-9"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <Label htmlFor="sub-address">Permanent Address</Label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                        <Input
                          id="sub-address"
                          value={subscriberAddress}
                          onChange={e => setSubscriberAddress(e.target.value)}
                          placeholder="Enter complete address"
                          className="pl-9"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <Label htmlFor="sub-pincode">Pincode</Label>
                      <Input
                        id="sub-pincode"
                        value={subscriberPincode}
                        onChange={e => setSubscriberPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit pincode"
                        maxLength={6}
                      />
                      <PincodeCheck
                        pincode={subscriberPincode}
                        onCheck={(serviceable, zone) => {
                          if (serviceable && zone) {
                            if (!subscriberCity) setSubscriberCity(zone.city || '');
                            if (!subscriberState) setSubscriberState(zone.state || '');
                          }
                        }}
                      />
                    </div>

                    <div className="space-y-1 col-span-1">
                      <Label htmlFor="sub-city">City</Label>
                      <div className="relative">
                        <Building className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                        <Input id="sub-city" className="pl-9" value={subscriberCity} onChange={e => setSubscriberCity(e.target.value)} placeholder="City" />
                      </div>
                    </div>

                    <div className="space-y-1 col-span-1">
                      <Label htmlFor="sub-state">State</Label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                        <Input id="sub-state" className="pl-9" value={subscriberState} onChange={e => setSubscriberState(e.target.value)} placeholder="State" />
                      </div>
                    </div>

                    <div className="space-y-1 col-span-2 border-t pt-4 mt-2">
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <Label className="text-amber-800 text-xs font-bold block mb-1">
                          ⚠️ DEV ONLY — Subscriber Password
                        </Label>
                        <Input
                          type="text"
                          value={subscriberPassword}
                          onChange={e => setSubscriberPassword(e.target.value)}
                          placeholder="Set subscriber test password (for app login testing)"
                          className="bg-white border-amber-300 focus-visible:ring-amber-500 text-sm"
                        />
                        <p className="text-[10px] text-amber-600 mt-1">
                          If left blank, subscriber defaults to OTP-only login.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* CSA mode info */}
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-800 flex gap-2 items-start">
                <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Beneficiary will start as Inactive.</strong> When the subscriber logs into the app, they will see an "Inactive - Verification Required" badge and must confirm/activate the beneficiary profile themselves.
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 2: Beneficiary ── */}
        {step === 'beneficiary' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserSquare className="w-5 h-5 text-primary" /> Beneficiary Profile</CardTitle>
              <CardDescription>The senior member receiving the care services</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl mb-4">
                <input
                  type="checkbox"
                  id="same-as-sub"
                  checked={sameAsSubscriber}
                  onChange={e => setSameAsSubscriber(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <label htmlFor="same-as-sub" className="text-sm font-semibold text-blue-900 cursor-pointer">
                  Beneficiary is the same as Subscriber ({subscriberName})
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 flex justify-center mb-2">
                  <div className="relative group">
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          setUploadingPhoto(true);
                          const res = await staffOnboardingApi.uploadFile(file);
                          if (res.success) {
                            setProfilePhoto(res.url);
                            toast.success('Photo uploaded');
                          }
                        } catch (err) {
                          toast.error('Upload failed');
                        } finally {
                          setUploadingPhoto(false);
                          if (e.target) e.target.value = '';
                        }
                      }} 
                    />
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center overflow-hidden border-2 border-dashed border-muted-foreground/30 relative cursor-pointer hover:border-primary transition-colors group"
                    >
                      {uploadingPhoto ? (
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      ) : profilePhoto ? (
                        <img src={sanitizeImgSrc(profilePhoto)} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-8 h-8 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                      )}
                      
                      {!profilePhoto && !uploadingPhoto && (
                        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-[10px] font-bold text-primary uppercase">Upload</span>
                        </div>
                      )}
                    </div>
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-1.5 bg-primary text-white rounded-full cursor-pointer shadow-lg hover:scale-110 active:scale-95 transition-all z-10"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {!sameAsSubscriber && (
                  <div className="space-y-1 col-span-2">
                    <Label htmlFor="ben-phone">Phone Number *</Label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                      <Input
                        id="ben-phone"
                        className="pl-9"
                        value={beneficiaryPhone}
                        onChange={e => setBeneficiaryPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="Beneficiary's mobile number"
                        maxLength={10}
                      />
                      {benPhoneChecking && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3 text-muted-foreground" />}
                    </div>

                    {beneficiaryPhone.length === 10 && beneficiaryPhone === subscriberPhone && (
                      <div className="flex items-start gap-2 text-xs px-3 py-2.5 rounded-xl border bg-red-50 text-red-700 border-red-200 mt-1">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>Beneficiary phone cannot be the same as Subscriber phone number. Select "Beneficiary is the same as Subscriber" above if they are the same person.</span>
                      </div>
                    )}

                    {beneficiaryPhone.length === 10 && beneficiaryPhone !== subscriberPhone && benPhoneCheck && benPhoneCheck.exists && (
                      <div className="flex items-start gap-2 text-xs px-3 py-2.5 rounded-xl border bg-red-50 text-red-700 border-red-200 mt-1">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>This phone number already exists in the database ({benPhoneCheck.name}). Beneficiary phone numbers must be unique.</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label htmlFor="ben-name">Beneficiary Name *</Label>
                  <Input id="ben-name" value={beneficiaryName} onChange={e => setBeneficiaryName(e.target.value)} placeholder="Full name" />
                </div>

                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label htmlFor="ben-dob">Date of Birth</Label>
                  <Input id="ben-dob" type="date" value={beneficiaryDob} onChange={e => setBeneficiaryDob(e.target.value)} />
                </div>

                <div className="space-y-1 sm:col-span-1 col-span-2">
                  <Label>Gender</Label>
                  <div className="flex gap-2">
                    {['male', 'female', 'other'].map(g => (
                      <Button 
                        key={g} 
                        type="button"
                        variant={beneficiaryGender === g ? 'default' : 'outline'}
                        className="flex-1 capitalize text-xs h-9"
                        onClick={() => setBeneficiaryGender(g)}
                      >
                        {g}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1 sm:col-span-1 col-span-2">
                  <Label>Marital Status</Label>
                  <select
                    className="w-full border border-input rounded-md h-9 px-3 text-sm bg-background"
                    value={maritalStatus}
                    onChange={e => setMaritalStatus(e.target.value)}
                  >
                    <option value="">Select Status</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="widowed">Widowed</option>
                    <option value="divorced">Divorced</option>
                  </select>
                </div>

                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label htmlFor="ben-addr">Residential Address</Label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input id="ben-addr" className="pl-9" value={beneficiaryAddress} onChange={e => setBeneficiaryAddress(e.target.value)} placeholder="Complete address" />
                  </div>
                </div>

                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label htmlFor="ben-pincode">Pincode</Label>
                  <Input 
                    id="ben-pincode" 
                    value={beneficiaryPincode} 
                    onChange={e => setBeneficiaryPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                    placeholder="6-digit pincode" 
                    maxLength={6}
                  />
                  <PincodeCheck 
                    pincode={beneficiaryPincode} 
                    onCheck={(serviceable, zone) => {
                      if (serviceable && zone && !sameAsSubscriber) {
                        if (!beneficiaryCity) setBeneficiaryCity(zone.city || '');
                        if (!beneficiaryState) setBeneficiaryState(zone.state || '');
                      }
                    }}
                  />
                </div>

                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label htmlFor="ben-city">City</Label>
                  <div className="relative">
                    <Building className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input id="ben-city" className="pl-9" value={beneficiaryCity} onChange={e => setBeneficiaryCity(e.target.value)} placeholder="City" />
                  </div>
                </div>

                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label htmlFor="ben-state">State</Label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input id="ben-state" className="pl-9" value={beneficiaryState} onChange={e => setBeneficiaryState(e.target.value)} placeholder="State" />
                  </div>
                </div>

                {!sameAsSubscriber && (
                  <div className="space-y-1 col-span-2">
                    <Label htmlFor="ben-rel">Relationship to Subscriber</Label>
                    <Select value={relationship} onValueChange={setRelationship}>
                      <SelectTrigger id="ben-rel">
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        {RELATIONSHIPS.map(rel => (
                          <SelectItem key={rel} value={rel}>{rel}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 3: Medical & Life ── */}
        {step === 'medical' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" /> Medical Information
                  </CardTitle>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1 rounded-full border-primary text-primary hover:bg-primary/5">
                      <Plus className="w-3.5 h-3.5" /> Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Add Medical Information</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                      <Input 
                        placeholder="e.g., Hypertension, Diabetes" 
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = e.currentTarget.value.trim();
                            if (val && !medicalConditions.includes(val)) {
                              setMedicalConditions([...medicalConditions, val]);
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                      />
                    </div>
                    <DialogFooter>
                      <Button 
                        className="w-full bg-orange-500 hover:bg-orange-600"
                        onClick={(e) => {
                           const input = e.currentTarget.closest('[role="dialog"]')?.querySelector('input');
                           if (input?.value.trim()) {
                             setMedicalConditions([...medicalConditions, input.value.trim()]);
                             input.value = '';
                           }
                        }}
                      >
                        Add Condition
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap gap-2 min-h-[40px]">
                  {medicalConditions.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No conditions added</p>
                  )}
                  {medicalConditions.map((condition) => (
                    <Badge 
                      key={condition} 
                      variant="secondary" 
                      className="bg-orange-50 text-orange-700 hover:bg-orange-100 border-none py-1.5 px-3 flex items-center gap-2 rounded-lg"
                    >
                      {condition}
                      <span
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer hover:text-orange-900 p-0.5 inline-flex items-center justify-center rounded-full hover:bg-orange-200/50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMedicalConditions(medicalConditions.filter(c => c !== condition));
                        }}
                      >
                        <X className="w-3 h-3" />
                      </span>
                    </Badge>
                  ))}
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-primary" /> Current Medications
                    </Label>
                    <Dialog open={isMedDialogOpen} onOpenChange={(open) => {
                      setIsMedDialogOpen(open);
                      if (!open) {
                        setMedName('');
                        setMedDosage('');
                        setMedFrequency('once_daily');
                        setMedSlots(['morning']);
                        setMedInstructions('');
                        setMedStartDate(new Date().toISOString().split('T')[0]);
                        setMedEndDate('');
                        setMedReminders(false);
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 gap-1 rounded-full border-primary text-primary hover:bg-primary/5">
                          <Plus className="w-3.5 h-3.5" /> Add
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>Add Medicine</DialogTitle>
                        </DialogHeader>
                        <form className="space-y-4 py-4" onSubmit={(e) => {
                          e.preventDefault();
                          if (!medName.trim()) {
                            toast.error('Medication name is required');
                            return;
                          }
                          if (medFrequency === 'once_daily' && medSlots.length !== 1) {
                            toast.error('Please select exactly 1 time slot for Once Daily');
                            return;
                          }
                          if (medFrequency === 'twice_daily' && medSlots.length !== 2) {
                            toast.error('Please select exactly 2 time slots for Twice Daily');
                            return;
                          }
                          if (medFrequency === 'thrice_daily' && medSlots.length !== 3) {
                            toast.error('Please select all 3 time slots for Thrice Daily');
                            return;
                          }
                          const newMed = {
                            name: medName.trim(),
                            dosage: medDosage,
                            frequency: medFrequency,
                            timeSlots: medSlots,
                            setReminders: medReminders,
                            startDate: medStartDate,
                            endDate: medEndDate || undefined,
                            instructions: medInstructions,
                          };
                          setMedications([...medications, newMed]);
                          setIsMedDialogOpen(false);
                        }}>
                          <div className="space-y-2">
                            <Label>Medication Name</Label>
                            <Input 
                              name="name" 
                              placeholder="e.g., Amoxicillin" 
                              required 
                              value={medName}
                              onChange={(e) => setMedName(e.target.value)}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Dosage</Label>
                              <Input 
                                name="dosage" 
                                placeholder="250mg" 
                                value={medDosage}
                                onChange={(e) => setMedDosage(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Frequency</Label>
                              <Select 
                                name="frequency" 
                                value={medFrequency} 
                                onValueChange={handleFrequencyChange}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="once_daily">Once Daily</SelectItem>
                                  <SelectItem value="twice_daily">Twice Daily</SelectItem>
                                  <SelectItem value="thrice_daily">Thrice Daily</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Instructions (Optional)</Label>
                            <Input 
                              name="instructions" 
                              placeholder="e.g., Take after food" 
                              value={medInstructions}
                              onChange={(e) => setMedInstructions(e.target.value)}
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Start Date</Label>
                              <Input 
                                name="startDate" 
                                type="date" 
                                value={medStartDate}
                                onChange={(e) => setMedStartDate(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>End Date (Optional)</Label>
                              <Input 
                                name="endDate" 
                                type="date" 
                                value={medEndDate}
                                onChange={(e) => setMedEndDate(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Times per day</Label>
                            <div className="flex gap-2">
                              {['morning', 'afternoon', 'evening'].map(slot => {
                                const isChecked = medSlots.includes(slot);
                                return (
                                  <div key={slot} className="flex-1">
                                    <button
                                      type="button"
                                      onClick={() => handleSlotToggle(slot)}
                                      className={`block w-full text-center py-2 text-xs rounded-full border cursor-pointer capitalize transition-colors ${
                                        isChecked 
                                          ? 'bg-orange-500 text-white border-orange-500 font-semibold' 
                                          : 'border-border text-muted-foreground hover:bg-secondary/20'
                                      }`}
                                    >
                                      {slot}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
                            <div className="space-y-0.5">
                              <Label className="text-sm">Set Reminders</Label>
                              <p className="text-[10px] text-muted-foreground">Get notified when it's time to take meds</p>
                            </div>
                            <Switch 
                              checked={medReminders} 
                              onCheckedChange={setMedReminders}
                            />
                          </div>
                          <DialogFooter className="pt-2">
                            <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600">Add to Schedule</Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="space-y-3">
                    {medications.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">No medications added</p>
                    )}
                    {medications.map((m, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl border border-border group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                             <Activity className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{m.name}</p>
                            <p className="text-[10px] text-muted-foreground">{m.dosage} • {m.frequency.replace('_', ' ')}</p>
                            <div className="flex gap-1 mt-1">
                              {m.timeSlots?.map((slot: string) => (
                                <Badge key={slot} variant="outline" className="text-[9px] py-0 px-1.5 h-4 capitalize bg-background">{slot}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" 
                          onClick={() => setMedications(medications.filter((_, idx) => idx !== i))}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dashed">
                  <div className="space-y-1">
                    <Label className="text-xs">Primary Physician Name</Label>
                    <Input value={primaryPhysicianName} onChange={e => setPrimaryPhysicianName(e.target.value)} placeholder="Dr. Name" className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Physician Phone Number</Label>
                    <Input value={primaryPhysicianPhone} onChange={e => setPrimaryPhysicianPhone(e.target.value)} placeholder="Contact number" className="h-9" />
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Heart className="w-4 h-4 text-primary" /> Hobbies & Interests
                  </Label>
                  
                  <div className="flex flex-wrap gap-2">
                    {dbHobbies.map((hobby) => {
                      const isSelected = hobby === 'Other'
                        ? (hobbiesInterests.includes('Other') || hobbiesInterests.some(h => !dbHobbies.includes(h)))
                        : hobbiesInterests.includes(hobby);
                      return (
                        <button
                          key={hobby}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              if (hobby === 'Other') {
                                // Deselecting 'Other' also removes all specified custom hobbies
                                setHobbiesInterests(hobbiesInterests.filter(h => dbHobbies.includes(h) && h !== 'Other'));
                              } else {
                                setHobbiesInterests(hobbiesInterests.filter(h => h !== hobby));
                              }
                            } else {
                              setHobbiesInterests([...hobbiesInterests, hobby]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            isSelected
                              ? 'bg-primary text-white border-primary shadow-sm'
                              : 'bg-white text-gray-600 border-[#E7DED6] hover:border-primary'
                          }`}
                        >
                          {hobby}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom hobbies badges with cross option to delete */}
                  {hobbiesInterests.filter(h => !dbHobbies.includes(h) && h !== 'Other').length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 animate-in fade-in slide-in-from-top-1">
                      {hobbiesInterests.filter(h => !dbHobbies.includes(h) && h !== 'Other').map((customHobbyItem) => (
                        <Badge 
                          key={customHobbyItem} 
                          variant="secondary" 
                          className="bg-orange-50 text-orange-700 hover:bg-orange-100 border-none py-1.5 px-3 flex items-center gap-2 rounded-lg text-xs"
                        >
                          {customHobbyItem}
                          <span
                            role="button"
                            tabIndex={0}
                            className="cursor-pointer hover:text-orange-900 p-0.5 inline-flex items-center justify-center rounded-full hover:bg-orange-200/50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHobbiesInterests(hobbiesInterests.filter(h => h !== customHobbyItem));
                            }}
                          >
                            <X className="w-3 h-3" />
                          </span>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="pt-2">
                    {(hobbiesInterests.includes('Other') || hobbiesInterests.some(h => !dbHobbies.includes(h))) && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                        <Label className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Specify Other Hobby</Label>
                        <Input 
                          placeholder="Type custom hobby and press enter..." 
                          className="h-9 text-xs border-orange-200 focus-visible:ring-orange-500"
                          value={customHobby}
                          onChange={e => setCustomHobby(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = customHobby.trim();
                              if (val && !hobbiesInterests.includes(val)) {
                                setHobbiesInterests([...hobbiesInterests.filter(h => h !== 'Other'), val]);
                                setCustomHobby('');
                              }
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-primary" /> Vitals to Track
                </CardTitle>
                {!loadingVitals && availableVitals.length > 0 && (
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-[10px] px-2 text-primary hover:text-primary-foreground border-primary/20 hover:border-primary"
                      onClick={() => {
                        const allChecked: Record<string, boolean> = {};
                        availableVitals.forEach(v => {
                          allChecked[v.code] = true;
                        });
                        setVitalsToTrack(allChecked);
                      }}
                    >
                      Check All
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-[10px] px-2 text-muted-foreground border-border hover:bg-secondary/50"
                      onClick={() => {
                        const allUnchecked: Record<string, boolean> = {};
                        availableVitals.forEach(v => {
                          allUnchecked[v.code] = false;
                        });
                        setVitalsToTrack(allUnchecked);
                      }}
                    >
                      Clear All
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 py-2">
                {loadingVitals ? (
                  <div className="col-span-2 py-4 flex items-center justify-center text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin mr-2" /> Loading vitals...
                  </div>
                ) : availableVitals.length === 0 ? (
                  <div className="col-span-2 py-4 text-center text-xs text-muted-foreground italic">
                    No vitals defined
                  </div>
                ) : availableVitals.map((v) => (
                  <div key={v.id} className="flex items-center gap-2">
                    <Checkbox 
                      id={`vital-${v.code}`} 
                      checked={vitalsToTrack[v.code]} 
                      onCheckedChange={checked => setVitalsToTrack({ ...vitalsToTrack, [v.code]: !!checked })} 
                    />
                    <label htmlFor={`vital-${v.code}`} className="text-xs font-medium cursor-pointer">
                      {v.name} {v.unit ? `(${v.unit})` : ''}
                    </label>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Step 4: Emergency Support ── */}
        {step === 'emergency' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary font-bold"><CheckCircle2 className="w-5 h-5" /> Primary Emergency Contact</CardTitle>
                <CardDescription>Highest priority contact for emergencies</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Full Name *</Label>
                    <Input value={emergencyContactName} onChange={e => setEmergencyContactName(e.target.value)} placeholder="Name" />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone Number *</Label>
                    <Input value={emergencyContactPhone} onChange={e => setEmergencyContactPhone(e.target.value)} placeholder="10-digit number" />
                  </div>
                  <div className="space-y-1">
                    <Label>Relationship</Label>
                    <Input value={emergencyContactRel} onChange={e => setEmergencyContactRel(e.target.value)} placeholder="e.g. Son" />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input value={emergencyContactEmail} onChange={e => setEmergencyContactEmail(e.target.value)} placeholder="email@ext.com" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Secondary Emergency Contact (Optional)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Full Name</Label>
                    <Input value={secondaryContactName} onChange={e => setSecondaryContactName(e.target.value)} placeholder="Name" className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone Number</Label>
                    <Input value={secondaryContactPhone} onChange={e => setSecondaryContactPhone(e.target.value)} placeholder="Number" className="h-9" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Step 5: Package & Schedule ── */}
        {step === 'package' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Package className="w-5 h-5 text-primary" /> Plan & Timing</CardTitle>
              <CardDescription>Select the care package and specify service timings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Service Preferred Slot</Label>
                <div className="grid grid-cols-3 gap-2">
                  {['Morning', 'Afternoon', 'Evening'].map(slot => (
                    <Button 
                      key={slot} 
                      type="button"
                      variant={preferredSlot === slot ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setPreferredSlot(slot)}
                    >
                      {slot}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-2">
                <Label>Choose Package</Label>
                {packages.filter(p => p.isActive).length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-8">No active packages found.</p>
                )}
                {packages.filter(p => p.isActive).map(pkg => (
                  <div
                    key={pkg.id}
                    onClick={() => setSelectedPackageId(pkg.id)}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${selectedPackageId === pkg.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{pkg.name}</p>
                          <Badge 
                            variant="secondary" 
                            className={`text-[9px] uppercase px-1.5 h-4 border-none ${
                              pkg.isGlobal 
                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' 
                                : pkg.regions && pkg.regions.length > 0
                                ? 'bg-[#FFE6D5] text-[#FF7A00] hover:bg-[#FFE6D5]'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {pkg.isGlobal ? 'Global' : pkg.regions && pkg.regions.length > 0 ? 'Region Based' : 'Private'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">₹{pkg.basePrice} / month</p>
                      </div>
                      {selectedPackageId === pkg.id && <Check className="w-5 h-5 text-primary" />}
                    </div>
                  </div>
                ))}
              </div>

              {selectedPackageId && (
                <>
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {DURATION_OPTIONS.map(d => (
                        <Button
                          key={d.value}
                          variant={duration === d.value ? 'default' : 'outline'}
                          onClick={() => setDuration(d.value)}
                          className="h-9 text-xs"
                        >
                          {d.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="start-date" className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-primary" /> Start Date
                      </Label>
                      <Input 
                        id="start-date" 
                        type="date" 
                        value={startDate} 
                        onChange={e => setStartDate(e.target.value)} 
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3 text-muted-foreground" /> Suggested End Date
                      </Label>
                      <div className="h-10 px-3 border border-border bg-slate-50 text-slate-500 rounded-md text-xs flex items-center font-mono">
                        {getSuggestedEndDate(startDate, duration) || 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* ── Add-on Benefits Picker ── */}
                  <div className="pt-4 border-t border-dashed space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                          Add-on Benefits (Optional)
                        </Label>
                        <p className="text-[10px] text-muted-foreground">Attach extra services or care visits to this enrollment</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAddonModalOpen(true)}
                        className="h-8 gap-1 rounded-full border-[#FF7A00] text-[#FF7A00] hover:bg-orange-50 font-bold"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" /> Add Add-on Benefit
                      </Button>
                    </div>

                    {selectedAddons.length > 0 && (
                      <div className="space-y-2">
                        {selectedAddons.map((addonItem, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-orange-50/50 rounded-xl border border-orange-200">
                            <div>
                              <p className="text-sm font-bold text-gray-800">{addonItem.benefit.name}</p>
                              <p className="text-[10px] text-muted-foreground">{addonItem.units} {addonItem.benefit.unitLabel || 'units'}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-black text-[#FF7A00]">₹{addonItem.totalAmount}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:bg-red-50"
                                onClick={() => setSelectedAddons(selectedAddons.filter((_, i) => i !== idx))}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Step 6: Payment ── */}
        {step === 'payment' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary" /> Payment Details</CardTitle>
              <CardDescription>Collect offline payment or generate an online Razorpay payment link for the customer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedPackage && (
                <div className="bg-secondary/40 rounded-xl p-4 space-y-3 mb-2 border border-slate-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-base text-slate-900">{pricing.packageName || selectedPackage.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {duration.replace('_', ' ')} plan ({pricing.months} mo) · starts {startDate}
                      </p>
                    </div>
                    {calculatingPrice && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-200 font-medium">
                        <Loader2 className="w-3 h-3 animate-spin" /> Calculating benefit taxes...
                      </span>
                    )}
                  </div>

                  {/* ── Benefit-by-Benefit Price & GST Breakdown (Excel Model) ── */}
                  {pricing.benefitsBreakdown && pricing.benefitsBreakdown.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Benefit Name</th>
                            <th className="py-2.5 px-3 text-right">Price</th>
                            <th className="py-2.5 px-3 text-center">GST %</th>
                            <th className="py-2.5 px-3 text-right">GST Amount</th>
                            <th className="py-2.5 px-3 text-right font-bold">Final Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800">
                          {pricing.benefitsBreakdown.map((b: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3">
                                <span className="font-semibold text-slate-900">{b.name}</span>
                                {b.units > 0 && (
                                  <span className="text-[11px] text-muted-foreground ml-1.5 font-normal">
                                    ({b.unitDisplay || `Units: ${b.units} ${b.unitType || b.unitLabel}`})
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right font-mono">₹{b.price?.toLocaleString('en-IN')}</td>
                              <td className="py-2 px-3 text-center">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  b.isGstExempt || b.gstRate === 0
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}>
                                  {b.isGstExempt ? '0% (Exempt)' : `${b.gstRate}%`}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-blue-900">
                                ₹{b.gstAmount?.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                ₹{b.finalPrice?.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}

                          {/* Addons if any */}
                          {pricing.addonsBreakdown && pricing.addonsBreakdown.length > 0 && (
                            <>
                              <tr className="bg-orange-50/50 font-semibold border-t border-orange-200">
                                <td colSpan={5} className="py-1 px-3 text-[10px] uppercase tracking-wider text-[#FF7A00]">
                                  Selected Add-on Benefits
                                </td>
                              </tr>
                              {pricing.addonsBreakdown.map((ao: any, idx: number) => (
                                <tr key={`addon-${idx}`} className="bg-orange-50/20 hover:bg-orange-50/40">
                                  <td className="py-2 px-3 font-medium text-orange-900">
                                    + {ao.name} ({ao.units} {ao.unitLabel})
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono">₹{ao.price?.toLocaleString('en-IN')}</td>
                                  <td className="py-2 px-3 text-center">
                                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200">
                                      {ao.isGstExempt ? '0%' : `${ao.gstRate}%`}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-orange-900">₹{ao.gstAmount?.toLocaleString('en-IN')}</td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-orange-950">₹{ao.finalPrice?.toLocaleString('en-IN')}</td>
                                </tr>
                              ))}
                            </>
                          )}
                        </tbody>
                        <tfoot className="bg-slate-50/90 font-medium border-t-2 border-slate-300 text-slate-800">
                          <tr>
                            <td colSpan={4} className="py-2 px-3 text-slate-700 font-semibold">
                              Package Gross Price (Sum of Benefit Final Prices)
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-950">
                              ₹{(pricing.packageGrossPrice + (pricing.addonsFinalTotal || 0))?.toLocaleString('en-IN')}
                            </td>
                          </tr>
                          {pricing.discountPercent > 0 && (
                            <tr className="text-emerald-700 bg-emerald-50/30">
                              <td colSpan={4} className="py-1.5 px-3">
                                Tenure Discount ({pricing.discountPercent}% off for {pricing.months} months)
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono font-bold">
                                - ₹{pricing.packageDiscount?.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          )}
                          <tr className="border-t-2 border-slate-300 bg-emerald-50/80 font-bold text-emerald-950 text-sm">
                            <td colSpan={4} className="py-2.5 px-3">
                              Final Payable Total (Sum after discount)
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-lg text-emerald-700">
                              ₹{pricing.finalTotalAmount?.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <PaymentMethodSelector
                amount={parseFloat(amountPaid) || pricing.finalTotalAmount || 4999}
                subscriberName={subscriberName || 'Subscriber'}
                subscriberPhone={subscriberPhone || ''}
                subscriberEmail={subscriberEmail || ''}
                packageName={`${selectedPackage?.name || 'Care Package'}${selectedAddons.length > 0 ? ` + ${selectedAddons.length} Add-on(s)` : ''}`}
                paymentMode={paymentMode}
                onPaymentModeChange={setPaymentMode}
                offlineMethod={paymentMethod}
                onOfflineMethodChange={setPaymentMethod}
                amountPaid={amountPaid}
                onAmountPaidChange={setAmountPaid}
                transactionId={transactionId}
                onTransactionIdChange={setTransactionId}
                paymentNote={paymentNote}
                onPaymentNoteChange={setPaymentNote}
                paymentLinkDetails={paymentLinkDetails}
                generatingLink={generatingLink}
                onPaymentCompleted={(completedDetails) => {
                  setPaymentMethod('Razorpay Online');
                  if (completedDetails?.orderId) setTransactionId(completedDetails.orderId);
                  toast.success('Online Payment Verified & Subscription Activated! 🎉');
                }}
                onGenerateLink={async () => {
                  setGeneratingLink(true);
                  try {
                    const res = await paymentApi.generateLink({
                      subscriberId: existingSubscriberId || '',
                      beneficiaryId: '',
                      subscriptionId: '',
                      packageType: selectedPackage?.type || selectedPackage?.name || 'gold',
                      packageName: `${selectedPackage?.name || 'Care Package'}${selectedAddons.length > 0 ? ` + ${selectedAddons.length} Add-ons` : ''}`,
                      amount: parseFloat(amountPaid) || pricing.finalTotalAmount || 4999,
                      subscriberPhone,
                      subscriberEmail,
                      subscriberName,
                      duration,
                    });
                    const data = res?.data || res;
                    if (data && (data.shortUrl || data.orderId)) {
                      setPaymentLinkDetails(data);
                      toast.success('Payment link generated successfully!');
                    }
                  } catch (err: any) {
                    toast.error(err.message || 'Failed to generate link');
                  } finally {
                    setGeneratingLink(false);
                  }
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* ── Step Preview ── */}
        {step === 'payment' && canProceedPayment && (
          <Card className="mt-4 border-dashed bg-secondary/20">
            <CardContent className="p-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Enrollment Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subscriber</span><span className="font-medium">{subscriberName} ({subscriberPhone})</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Beneficiary</span><span className="font-medium">{sameAsSubscriber ? subscriberName : beneficiaryName} {!sameAsSubscriber && beneficiaryPhone ? `(${beneficiaryPhone})` : ''}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Package</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{selectedPackage?.name}</span>
                    {selectedPackage && (
                      <Badge 
                        variant="secondary" 
                        className={`text-[8px] uppercase px-1 h-3.5 border-none ${
                          selectedPackage.isGlobal 
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' 
                            : selectedPackage.regions && selectedPackage.regions.length > 0
                            ? 'bg-[#FFE6D5] text-[#FF7A00] hover:bg-[#FFE6D5]'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {selectedPackage.isGlobal ? 'Global' : selectedPackage.regions && selectedPackage.regions.length > 0 ? 'Region Based' : 'Private'}
                      </Badge>
                    )}
                  </div>
                </div>
                {selectedAddons.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Add-ons</span>
                    <span className="font-medium text-[#FF7A00]">{selectedAddons.map(a => `${a.benefit.name} (${a.units}u)`).join(', ')}</span>
                  </div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Duration</span><span className="font-medium capitalize">{duration.replace('_', ' ')} · until {endDate}</span></div>
                <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground">Amount</span><span className="font-bold text-green-700">₹{amountPaid} via {paymentMethod}</span></div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Navigation buttons ── */}
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={goBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {step === 'subscriber' ? 'Cancel' : 'Back'}
          </Button>

          {step !== 'payment' ? (
            <Button
              onClick={goNext}
              disabled={
                (step === 'subscriber' && !canProceedSubscriber) ||
                (step === 'beneficiary' && !canProceedBeneficiary) ||
                (step === 'emergency' && (!emergencyContactName || !emergencyContactPhone)) ||
                (step === 'package' && !canProceedPackage)
              }
              className="bg-primary"
            >
              Next <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleEnroll}
              disabled={!canProceedPayment || enrolling}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {enrolling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              {enrolling ? 'Enrolling...' : 'Enroll Now'}
            </Button>
          )}
        </div>
      </div>

      {/* Add-on Benefit Modal */}
      <AddonBenefitModal
        isOpen={isAddonModalOpen}
        onClose={() => setIsAddonModalOpen(false)}
        beneficiaryName={beneficiaryName}
        subscriberName={subscriberName}
        subscriberPhone={subscriberPhone}
        subscriberEmail={subscriberEmail}
        defaultPincode={beneficiaryPincode || subscriberPincode}
        standaloneSelectMode={true}
        onSelectAddonForWizard={(newAddon) => {
          setSelectedAddons(prev => [...prev, newAddon]);
          toast.success(`Added "${newAddon.benefit.name}" to enrollment!`);
        }}
      />
    </div>
  );
}
