/**
 * Renewal Wizard — Admin-side subscription renewal
 * Exact same 6-step wizard as EnrollmentWizardPage, but pre-filled with existing data.
 * Fields that are changed from original are highlighted in amber.
 * Submits to subscriptionApi.renewSubscription() — never creates a new subscriber.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '../components/common/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { subscriptionApi, packageApi, staffOnboardingApi, vitalApi, hobbyApi, paymentApi } from '../../services/api';
import { PaymentMethodSelector } from '../components/payment/PaymentMethodSelector';
import { toast } from 'sonner';
import { AddonBenefitModal } from '../components/addons/AddonBenefitModal';
import { InvoiceViewModal } from '../components/InvoiceViewModal';
import {
  RefreshCw, ArrowLeft, ArrowRight, Check, Phone, User, Package,
  CreditCard, CheckCircle2, Loader2, AlertCircle, Users,
  Info, Calendar, Activity, ShieldAlert, Plus, Trash2, HeartPulse,
  Mail, MapPin, Camera, UserSquare, Stethoscope, Heart, Building, X, Clock,
  Lock, Pencil, Printer,
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

export default function RenewalWizardPage() {
  const { subscriptionId } = useParams<{ subscriptionId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('subscriber');
  const [renewing, setRenewing] = useState(false);
  const [renewedResult, setRenewedResult] = useState<any>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Original snapshot for diff detection
  const [original, setOriginal] = useState<any>({});

  // ── Subscriber (read-only in renewal, shown for context)
  const [subscriberPhone, setSubscriberPhone] = useState('');
  const [subscriberName, setSubscriberName] = useState('');
  const [subscriberEmail, setSubscriberEmail] = useState('');
  const [subscriberAddress, setSubscriberAddress] = useState('');
  const [subscriberPincode, setSubscriberPincode] = useState('');
  const [subscriberCity, setSubscriberCity] = useState('');
  const [subscriberState, setSubscriberState] = useState('');

  // ── Beneficiary (editable)
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryPhone, setBeneficiaryPhone] = useState('');
  const [beneficiaryDob, setBeneficiaryDob] = useState('');
  const [beneficiaryAge, setBeneficiaryAge] = useState('');
  const [beneficiaryGender, setBeneficiaryGender] = useState('prefer_not_to_say');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [beneficiaryAddress, setBeneficiaryAddress] = useState('');
  const [beneficiaryPincode, setBeneficiaryPincode] = useState('');
  const [beneficiaryCity, setBeneficiaryCity] = useState('');
  const [beneficiaryState, setBeneficiaryState] = useState('');
  const [relationship, setRelationship] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Medical & Vitals
  const [medicalConditions, setMedicalConditions] = useState<string[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [vitalsToTrack, setVitalsToTrack] = useState<Record<string, boolean>>({});
  const [availableVitals, setAvailableVitals] = useState<any[]>([]);
  const [loadingVitals, setLoadingVitals] = useState(false);
  const [primaryPhysicianName, setPrimaryPhysicianName] = useState('');
  const [primaryPhysicianPhone, setPrimaryPhysicianPhone] = useState('');
  const [hobbiesInterests, setHobbiesInterests] = useState<string[]>([]);
  const [customHobby, setCustomHobby] = useState('');
  const [dbHobbies, setDbHobbies] = useState<string[]>(COMMON_HOBBIES);

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
  const [renewalMode, setRenewalMode] = useState<'from_expiry' | 'today'>('from_expiry');
  const [customStartDate, setCustomStartDate] = useState('');
  const [currentExpiryDate, setCurrentExpiryDate] = useState('');

  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [transactionId, setTransactionId] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentMode, setPaymentMode] = useState<'offline' | 'online_link'>('offline');
  const [paymentLinkDetailsState, setPaymentLinkDetailsState] = useState<any>(() => {
    try {
      const saved = sessionStorage.getItem(`renewal_payment_link_details_${subscriptionId}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setPaymentLinkDetails = (data: any) => {
    setPaymentLinkDetailsState(data);
    if (data) {
      sessionStorage.setItem(`renewal_payment_link_details_${subscriptionId}`, JSON.stringify(data));
    } else {
      sessionStorage.removeItem(`renewal_payment_link_details_${subscriptionId}`);
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
        if (maxSlots === 1) setMedSlots([slot]);
        else setMedSlots([...times.slice(1), slot]);
      } else {
        setMedSlots([...times, slot]);
      }
    }
  };

  // ── Helper: was this field changed from original?
  const changed = (field: string, current: any) =>
    original[field] !== undefined && original[field] !== current;

  // amber highlight class when a field was modified
  const modClass = (field: string, current: any) =>
    changed(field, current)
      ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300 focus-visible:ring-amber-400'
      : '';

  // ── Load renewal data on mount
  useEffect(() => {
    if (!subscriptionId) return;
    setLoading(true);
    Promise.all([
      subscriptionApi.getRenewalData(subscriptionId),
      packageApi.getAll(),
      vitalApi.getAll({ activeOnly: true }),
      hobbyApi.getAll({ activeOnly: true }),
    ])
      .then(([rd, pkgs, vitals, hobbies]) => {
        setPackages(pkgs || []);

        // Vitals
        const initialVitals: Record<string, boolean> = {};
        (vitals || []).forEach((v: any) => { initialVitals[v.code] = false; });
        setAvailableVitals(vitals || []);

        // Hobbies
        if (hobbies && hobbies.length > 0) {
          const names = hobbies.map((h: any) => h.name);
          const hasOther = names.includes('Other');
          const sorted = [...names.filter((n: string) => n !== 'Other')];
          if (hasOther) sorted.push('Other');
          setDbHobbies(sorted);
        }

        if (!rd) return;

        // Build original snapshot for diff
        const snap: any = {};

        // Subscriber
        const sub = rd.subscriber || {};
        snap.subscriberId = sub.id || rd.subscription?.subscriberId || '';
        snap.subscriberPhone = sub.phone || '';
        snap.subscriberName = sub.name || '';
        snap.subscriberEmail = sub.email || '';
        snap.subscriberAddress = sub.address || '';
        snap.subscriberPincode = sub.pincode || '';
        snap.subscriberCity = sub.city || '';
        snap.subscriberState = sub.state || '';

        setSubscriberPhone(snap.subscriberPhone);
        setSubscriberName(snap.subscriberName);
        setSubscriberEmail(snap.subscriberEmail);
        setSubscriberAddress(snap.subscriberAddress);
        setSubscriberPincode(snap.subscriberPincode);
        setSubscriberCity(snap.subscriberCity);
        setSubscriberState(snap.subscriberState);

        // Beneficiary
        const ben = rd.beneficiary || {};
        snap.beneficiaryId = ben.id || rd.subscription?.beneficiaryId || '';
        snap.beneficiaryName = ben.name || '';
        snap.beneficiaryPhone = ben.phone || '';
        snap.beneficiaryDob = ben.dateOfBirth ? ben.dateOfBirth.split('T')[0] : '';
        snap.beneficiaryAge = ben.age ? String(ben.age) : '';
        snap.beneficiaryGender = ben.gender || 'prefer_not_to_say';
        snap.maritalStatus = ben.maritalStatus || '';
        snap.profilePhoto = ben.profilePhoto || '';
        snap.beneficiaryAddress = ben.address || '';
        snap.beneficiaryPincode = ben.pincode || '';
        snap.beneficiaryCity = ben.city || '';
        snap.beneficiaryState = ben.state || '';
        snap.relationship = ben.relationship || '';
        snap.primaryPhysicianName = ben.primaryPhysicianName || '';
        snap.primaryPhysicianPhone = ben.primaryPhysicianPhone || '';

        setBeneficiaryName(snap.beneficiaryName);
        setBeneficiaryPhone(snap.beneficiaryPhone);
        setBeneficiaryDob(snap.beneficiaryDob);
        setBeneficiaryAge(snap.beneficiaryAge);
        setBeneficiaryGender(snap.beneficiaryGender);
        setMaritalStatus(snap.maritalStatus);
        setProfilePhoto(snap.profilePhoto);
        setBeneficiaryAddress(snap.beneficiaryAddress);
        setBeneficiaryPincode(snap.beneficiaryPincode);
        setBeneficiaryCity(snap.beneficiaryCity);
        setBeneficiaryState(snap.beneficiaryState);
        setRelationship(snap.relationship);
        setPrimaryPhysicianName(snap.primaryPhysicianName);
        setPrimaryPhysicianPhone(snap.primaryPhysicianPhone);

        // Medical
        const existingMedConds = rd.medicalConditions?.map((m: any) => 
          typeof m === 'string' ? m : (m.name || m.condition?.name || (typeof m.condition === 'string' ? m.condition : ''))
        ).filter(Boolean) || [];
        snap.medicalConditions = JSON.stringify(existingMedConds);
        setMedicalConditions(existingMedConds);

        const existingMeds = rd.medications || [];
        snap.medications = JSON.stringify(existingMeds);
        setMedications(existingMeds);

        // Hobbies
        const existingHobbies = ben.hobbiesInterests || [];
        snap.hobbiesInterests = JSON.stringify(existingHobbies);
        setHobbiesInterests(existingHobbies);

        // Vitals from beneficiary config
        const existingVitalCodes = rd.vitalsToTrack || ben.vitalsToTrack || {};
        const mergedVitals = { ...initialVitals, ...existingVitalCodes };
        snap.vitalsToTrack = JSON.stringify(mergedVitals);
        setVitalsToTrack(mergedVitals);

        // Emergency contacts
        const contacts = rd.emergencyContacts || [];
        const primary = contacts.find((c: any) => c.isPrimary) || contacts[0] || {};
        const secondary = contacts.find((c: any) => !c.isPrimary && c !== primary) || {};

        snap.emergencyContactName = primary.name || '';
        snap.emergencyContactPhone = primary.phone || '';
        snap.emergencyContactRel = primary.relationship || 'Family';
        snap.emergencyContactEmail = primary.email || '';
        snap.secondaryContactName = secondary.name || '';
        snap.secondaryContactPhone = secondary.phone || '';
        snap.secondaryContactRel = secondary.relationship || '';
        snap.secondaryContactEmail = secondary.email || '';

        setEmergencyContactName(snap.emergencyContactName);
        setEmergencyContactPhone(snap.emergencyContactPhone);
        setEmergencyContactRel(snap.emergencyContactRel);
        setEmergencyContactEmail(snap.emergencyContactEmail);
        setSecondaryContactName(snap.secondaryContactName);
        setSecondaryContactPhone(snap.secondaryContactPhone);
        setSecondaryContactRel(snap.secondaryContactRel);
        setSecondaryContactEmail(snap.secondaryContactEmail);

        // Package / timing
        const currentSub = rd.subscription || {};
        const currentPkg = rd.currentPackage || {};
        snap.selectedPackageId = currentPkg.id || '';
        snap.duration = currentSub.duration || 'monthly';
        snap.preferredSlot = currentSub.preferredSlot || 'Morning';

        setSelectedPackageId(snap.selectedPackageId);
        setDuration(snap.duration);
        setPreferredSlot(snap.preferredSlot);

        // Store expiry to default the renewal start date
        if (currentSub.endDate) {
          const expiryStr = currentSub.endDate.split('T')[0];
          setCurrentExpiryDate(expiryStr);
          setCustomStartDate(expiryStr);
        }

        setOriginal(snap);

        // Check if there is saved session state for this subscription renewal
        const saved = sessionStorage.getItem(`renewal_wizard_data_${subscriptionId}`);
        if (saved) {
          try {
            const data = JSON.parse(saved);
            if (data.step) setStep(data.step);
            if (data.beneficiaryName !== undefined) setBeneficiaryName(data.beneficiaryName);
            if (data.beneficiaryDob !== undefined) setBeneficiaryDob(data.beneficiaryDob);
            if (data.beneficiaryAge !== undefined) setBeneficiaryAge(data.beneficiaryAge);
            if (data.beneficiaryGender !== undefined) setBeneficiaryGender(data.beneficiaryGender);
            if (data.maritalStatus !== undefined) setMaritalStatus(data.maritalStatus);
            if (data.profilePhoto !== undefined) setProfilePhoto(data.profilePhoto);
            if (data.beneficiaryAddress !== undefined) setBeneficiaryAddress(data.beneficiaryAddress);
            if (data.beneficiaryPincode !== undefined) setBeneficiaryPincode(data.beneficiaryPincode);
            if (data.beneficiaryCity !== undefined) setBeneficiaryCity(data.beneficiaryCity);
            if (data.beneficiaryState !== undefined) setBeneficiaryState(data.beneficiaryState);
            if (data.relationship !== undefined) setRelationship(data.relationship);
            if (data.medicalConditions !== undefined) {
              const sanitized = Array.isArray(data.medicalConditions)
                ? data.medicalConditions.map((c: any) => typeof c === 'string' ? c : (c?.name || c?.condition?.name || '')).filter(Boolean)
                : [];
              setMedicalConditions(sanitized);
            }
            if (data.medications !== undefined) setMedications(data.medications);
            if (data.vitalsToTrack !== undefined) setVitalsToTrack(data.vitalsToTrack);
            if (data.primaryPhysicianName !== undefined) setPrimaryPhysicianName(data.primaryPhysicianName);
            if (data.primaryPhysicianPhone !== undefined) setPrimaryPhysicianPhone(data.primaryPhysicianPhone);
            if (data.hobbiesInterests !== undefined) setHobbiesInterests(data.hobbiesInterests);
            if (data.customHobby !== undefined) setCustomHobby(data.customHobby);
            if (data.emergencyContactName !== undefined) setEmergencyContactName(data.emergencyContactName);
            if (data.emergencyContactPhone !== undefined) setEmergencyContactPhone(data.emergencyContactPhone);
            if (data.emergencyContactRel !== undefined) setEmergencyContactRel(data.emergencyContactRel);
            if (data.emergencyContactEmail !== undefined) setEmergencyContactEmail(data.emergencyContactEmail);
            if (data.secondaryContactName !== undefined) setSecondaryContactName(data.secondaryContactName);
            if (data.secondaryContactPhone !== undefined) setSecondaryContactPhone(data.secondaryContactPhone);
            if (data.secondaryContactRel !== undefined) setSecondaryContactRel(data.secondaryContactRel);
            if (data.secondaryContactEmail !== undefined) setSecondaryContactEmail(data.secondaryContactEmail);
            if (data.preferredSlot !== undefined) setPreferredSlot(data.preferredSlot);
            if (data.selectedPackageId !== undefined) setSelectedPackageId(data.selectedPackageId);
            if (data.duration !== undefined) setDuration(data.duration);
            if (data.renewalMode !== undefined) setRenewalMode(data.renewalMode);
            if (data.customStartDate !== undefined) setCustomStartDate(data.customStartDate);
            if (data.amountPaid !== undefined) setAmountPaid(data.amountPaid);
            if (data.paymentMethod !== undefined) setPaymentMethod(data.paymentMethod);
            if (data.transactionId !== undefined) setTransactionId(data.transactionId);
            if (data.paymentNote !== undefined) setPaymentNote(data.paymentNote);
          } catch (e) {
            console.warn('Failed to restore saved renewal wizard state', e);
          }
        }
      })
      .catch(err => {
        toast.error('Failed to load renewal data: ' + (err.message || err));
      })
      .finally(() => setLoading(false));
  }, [subscriptionId]);

  // Sync state to sessionStorage
  useEffect(() => {
    if (!subscriptionId || step === 'confirm' || loading) return;
    const data = {
      step, beneficiaryName, beneficiaryDob, beneficiaryAge, beneficiaryGender, maritalStatus, profilePhoto,
      beneficiaryAddress, beneficiaryPincode, beneficiaryCity, beneficiaryState, relationship, medicalConditions,
      medications, vitalsToTrack, primaryPhysicianName, primaryPhysicianPhone, hobbiesInterests, customHobby,
      emergencyContactName, emergencyContactPhone, emergencyContactRel, emergencyContactEmail, secondaryContactName,
      secondaryContactPhone, secondaryContactRel, secondaryContactEmail, preferredSlot, selectedPackageId,
      duration, renewalMode, customStartDate, amountPaid, paymentMethod, transactionId, paymentNote
    };
    sessionStorage.setItem(`renewal_wizard_data_${subscriptionId}`, JSON.stringify(data));
  }, [
    subscriptionId, step, loading, beneficiaryName, beneficiaryDob, beneficiaryAge, beneficiaryGender, maritalStatus,
    profilePhoto, beneficiaryAddress, beneficiaryPincode, beneficiaryCity, beneficiaryState, relationship,
    medicalConditions, medications, vitalsToTrack, primaryPhysicianName, primaryPhysicianPhone, hobbiesInterests,
    customHobby, emergencyContactName, emergencyContactPhone, emergencyContactRel, emergencyContactEmail,
    secondaryContactName, secondaryContactPhone, secondaryContactRel, secondaryContactEmail, preferredSlot,
    selectedPackageId, duration, renewalMode, customStartDate, amountPaid, paymentMethod, transactionId, paymentNote
  ]);

  // Authoritative server-side price & tax calculation
  useEffect(() => {
    if (!selectedPackageId) {
      setServerPricing(null);
      return;
    }
    let isMounted = true;
    setCalculatingPrice(true);
    subscriptionApi.calculatePrice({
      packageId: selectedPackageId,
      duration,
      addons: selectedAddons.map(a => ({
        benefitId: a.benefit.id,
        units: a.units,
        totalAmount: a.totalAmount,
      })),
      customerState: beneficiaryState || 'Haryana',
    })
      .then(p => {
        if (isMounted) {
          setServerPricing(p);
          setAmountPaid(String(p.finalTotalAmount));
        }
      })
      .catch(err => {
        console.error('Server pricing error:', err);
        const pkg = packages.find(p => p.id === selectedPackageId);
        const local = calculateWizardPricing(pkg, duration, selectedAddons, beneficiaryState);
        if (isMounted) {
          setServerPricing(local);
          setAmountPaid(String(local.finalTotalAmount));
        }
      })
      .finally(() => {
        if (isMounted) setCalculatingPrice(false);
      });

    return () => { isMounted = false; };
  }, [selectedPackageId, duration, packages, selectedAddons, beneficiaryState]);

  const stepIndex = STEPS.findIndex(s => s.id === step);
  const selectedPackage = packages.find(p => p.id === selectedPackageId);
  const pricing = serverPricing || calculateWizardPricing(selectedPackage, duration, selectedAddons, beneficiaryState);

  const getSuggestedEndDate = (startStr: string, dur: string): string => {
    if (!startStr) return '';
    try {
      const date = new Date(startStr);
      if (isNaN(date.getTime())) return '';
      const opt = DURATION_OPTIONS.find(d => d.value === dur);
      const months = opt ? opt.months : 1;
      date.setMonth(date.getMonth() + months);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    } catch {
      return '';
    }
  };

  const computeStartDate = (): string => {
    if (renewalMode === 'today') return new Date().toISOString().split('T')[0];
    return customStartDate || currentExpiryDate || new Date().toISOString().split('T')[0];
  };

  const endDate = (() => {
    const startStr = computeStartDate();
    if (!startStr) return '';
    const d = new Date(startStr);
    if (duration === 'three_months') d.setMonth(d.getMonth() + 3);
    else if (duration === 'six_months') d.setMonth(d.getMonth() + 6);
    else if (duration === 'annual') d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  })();

  const goNext = () => {
    const nextIndex = Math.min(STEPS.length - 1, stepIndex + 1);
    setStep(STEPS[nextIndex].id);
  };

  const goBack = () => {
    if (stepIndex === 0) return navigate(-1);
    const prevIndex = Math.max(0, stepIndex - 1);
    setStep(STEPS[prevIndex].id);
  };

  // Guard: payment can proceed
  const canProceedPackage = !!selectedPackageId;
  const canProceedPayment = !!amountPaid && parseFloat(amountPaid) >= 0;
  const canProceedEmergency = emergencyContactName.trim().length > 0 && emergencyContactPhone.length >= 10;

  const handleRenew = async () => {
    if (!subscriptionId) return;
    setRenewing(true);
    try {
      // Build changed fields summary
      const changedFields: Record<string, { old: any; new: any }> = {};
      const check = (key: string, oldVal: any, newVal: any) => {
        if (oldVal !== newVal) changedFields[key] = { old: oldVal, new: newVal };
      };
      check('beneficiaryName', original.beneficiaryName, beneficiaryName);
      check('beneficiaryDob', original.beneficiaryDob, beneficiaryDob);
      check('beneficiaryGender', original.beneficiaryGender, beneficiaryGender);
      check('beneficiaryAddress', original.beneficiaryAddress, beneficiaryAddress);
      check('beneficiaryCity', original.beneficiaryCity, beneficiaryCity);
      check('beneficiaryState', original.beneficiaryState, beneficiaryState);
      check('beneficiaryPincode', original.beneficiaryPincode, beneficiaryPincode);
      check('primaryPhysicianName', original.primaryPhysicianName, primaryPhysicianName);
      check('primaryPhysicianPhone', original.primaryPhysicianPhone, primaryPhysicianPhone);
      check('emergencyContactName', original.emergencyContactName, emergencyContactName);
      check('emergencyContactPhone', original.emergencyContactPhone, emergencyContactPhone);
      check('selectedPackageId', original.selectedPackageId, selectedPackageId);
      check('duration', original.duration, duration);

      const result = await subscriptionApi.renewSubscription(subscriptionId, {
        changedFields,
        vitalsToTrack,
        packageId: selectedPackageId,
        duration,
        renewalMode,
        customStartDate: computeStartDate(),
        payment: {
          amountPaid: parseFloat(amountPaid) || 0,
          paymentMethod,
          transactionId,
          paymentNote,
        },
      });

      // Allocate any selected add-ons
      const newSubId = result?.newSubscription?.id || (result as any)?.subscription?.id || (result as any)?.id || (result as any)?.data?.newSubscription?.id;
      if (newSubId && selectedAddons.length > 0) {
        for (const addon of selectedAddons) {
          await subscriptionApi.allocateAddon(newSubId, {
            benefitId: addon.benefit.id,
            units: addon.units,
            amountPaid: addon.totalAmount,
            paymentMethod,
            paymentNote: `Renewal Add-on: ${addon.benefit.name}`,
          }).catch(e => console.warn('Addon allocation warning on renew:', e));
        }
      }

      setRenewedResult(result);
      setStep('confirm');
      sessionStorage.removeItem(`renewal_wizard_data_${subscriptionId}`);
      toast.success('Subscription renewed successfully! ✅');
    } catch (err: any) {
      toast.error(err.message || 'Renewal failed');
    } finally {
      setRenewing(false);
    }
  };

  // ── Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Loading renewal data…</p>
      </div>
    );
  }

  // ── Success screen
  if (step === 'confirm' && renewedResult) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Renewal Complete!</h1>
        <p className="text-muted-foreground mb-8">The subscription has been successfully renewed.</p>

        <Card className="mb-6 text-left">
          <CardContent className="p-5 space-y-3">
            <div className="flex justify-between items-center text-sm bg-orange-50/50 p-2.5 rounded-xl border border-orange-100">
              <div>
                <span className="text-muted-foreground text-xs block font-semibold">Statutory GST Invoice</span>
                <span className="font-bold font-mono text-[#FF7A00] text-sm">{renewedResult.invoiceNumber}</span>
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
              <span className="font-semibold">{renewedResult.subscriber?.name} ({renewedResult.subscriber?.phone})</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-dashed mb-2">
              <div className="flex items-center gap-3">
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Beneficiary" className="w-12 h-12 rounded-full object-cover border-2 border-primary/20" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                    <UserSquare className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground text-xs block uppercase font-bold tracking-tighter">Beneficiary</span>
                  <span className="font-bold text-lg leading-none">{renewedResult.beneficiary?.name}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Package</span>
              <span className="font-semibold">{renewedResult.package?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valid Until</span>
              <span className="font-semibold text-green-700">{renewedResult.endDate ? new Date(renewedResult.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-3">
              <span className="text-muted-foreground">Amount Collected</span>
              <span className="font-bold text-green-700">₹{amountPaid} <span className="font-normal text-muted-foreground">via {paymentMethod}</span></span>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-center">
          <Button onClick={() => navigate('/renewals')} variant="outline">
            <Users className="w-4 h-4 mr-2" /> Worklist
          </Button>
          <Button onClick={() => navigate('/subscribers')} className="bg-primary">
            <User className="w-4 h-4 mr-2" /> View Subscribers
          </Button>
        </div>

        {/* Statutory Invoice Modal */}
        <InvoiceViewModal
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          invoiceId={renewedResult.invoiceId || renewedResult.invoiceNumber}
        />
      </div>
    );
  }

  return (
    <div className="pb-20">
      <PageHeader
        title="Renew Subscription"
        description={`Reviewing renewal for ${beneficiaryName || 'beneficiary'} · ${subscriberName || 'subscriber'}`}
        action={
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        }
      />

      {/* Amber "renewal mode" banner */}
      <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 items-start text-amber-800 text-sm">
        <RefreshCw className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
        <span>
          <strong>Renewal Mode:</strong> All fields are pre-filled with existing data. Only change what is different. Modified fields will be highlighted in <span className="bg-amber-100 border border-amber-300 px-1 rounded text-xs font-mono">amber</span>. No new subscriber account will be created.
        </span>
      </div>

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

        {/* ── Step 1: Subscriber (READ-ONLY in renewal) ── */}
        {step === 'subscriber' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" /> Subscriber Information
              </CardTitle>
              <CardDescription>Subscriber details are locked during renewal. Contact support to update subscriber info.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Locked banner */}
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3 text-blue-800 text-sm">
                <Lock className="w-4 h-4 flex-shrink-0" />
                <span><strong>Subscriber is pre-loaded.</strong> These fields are read-only during renewal to preserve account integrity.</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label>Phone Number</Label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input value={subscriberPhone} readOnly className="pl-9 bg-muted text-muted-foreground cursor-not-allowed" />
                  </div>
                </div>
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label>Full Name</Label>
                  <Input value={subscriberName} readOnly className="bg-muted text-muted-foreground cursor-not-allowed" />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Email Address</Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input value={subscriberEmail} readOnly className="pl-9 bg-muted text-muted-foreground cursor-not-allowed" />
                  </div>
                </div>
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label>Address</Label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input value={subscriberAddress} readOnly className="pl-9 bg-muted text-muted-foreground cursor-not-allowed" />
                  </div>
                </div>
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label>Pincode</Label>
                  <Input value={subscriberPincode} readOnly className="bg-muted text-muted-foreground cursor-not-allowed" />
                </div>
                <div className="space-y-1 col-span-1">
                  <Label>City</Label>
                  <div className="relative">
                    <Building className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input value={subscriberCity} readOnly className="pl-9 bg-muted text-muted-foreground cursor-not-allowed" />
                  </div>
                </div>
                <div className="space-y-1 col-span-1">
                  <Label>State</Label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input value={subscriberState} readOnly className="pl-9 bg-muted text-muted-foreground cursor-not-allowed" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 2: Beneficiary ── */}
        {step === 'beneficiary' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserSquare className="w-5 h-5 text-primary" /> Beneficiary Profile</CardTitle>
              <CardDescription>Review and update the beneficiary's details if anything has changed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                {/* Photo upload */}
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
                          if (res.success) { setProfilePhoto(res.url); toast.success('Photo uploaded'); }
                        } catch { toast.error('Upload failed'); }
                        finally { setUploadingPhoto(false); if (e.target) e.target.value = ''; }
                      }}
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center overflow-hidden border-2 border-dashed border-muted-foreground/30 relative cursor-pointer hover:border-primary transition-colors group"
                    >
                      {uploadingPhoto ? (
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      ) : profilePhoto ? (
                        <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
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

                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label htmlFor="ben-name">Beneficiary Name *</Label>
                  <Input
                    id="ben-name"
                    value={beneficiaryName}
                    onChange={e => setBeneficiaryName(e.target.value)}
                    placeholder="Full name"
                    className={modClass('beneficiaryName', beneficiaryName)}
                  />
                  {changed('beneficiaryName', beneficiaryName) && (
                    <p className="text-xs text-amber-600 flex items-center gap-1"><Pencil className="w-3 h-3" /> Changed from: {original.beneficiaryName}</p>
                  )}
                </div>

                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label>Phone Number</Label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input value={beneficiaryPhone} readOnly className="pl-9 bg-muted text-muted-foreground cursor-not-allowed" />
                  </div>
                  <p className="text-xs text-muted-foreground">Phone cannot be changed during renewal</p>
                </div>

                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label htmlFor="ben-dob">Date of Birth</Label>
                  <Input
                    id="ben-dob"
                    type="date"
                    value={beneficiaryDob}
                    onChange={e => setBeneficiaryDob(e.target.value)}
                    className={modClass('beneficiaryDob', beneficiaryDob)}
                  />
                  {changed('beneficiaryDob', beneficiaryDob) && (
                    <p className="text-xs text-amber-600 flex items-center gap-1"><Pencil className="w-3 h-3" /> Changed from: {original.beneficiaryDob}</p>
                  )}
                </div>

                <div className="space-y-1 sm:col-span-1 col-span-2">
                  <Label>Gender</Label>
                  <div className={`flex gap-2 ${changed('beneficiaryGender', beneficiaryGender) ? 'ring-1 ring-amber-400 rounded-lg p-1' : ''}`}>
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
                  {changed('beneficiaryGender', beneficiaryGender) && (
                    <p className="text-xs text-amber-600 flex items-center gap-1"><Pencil className="w-3 h-3" /> Changed from: {original.beneficiaryGender}</p>
                  )}
                </div>

                <div className="space-y-1 sm:col-span-1 col-span-2">
                  <Label>Marital Status</Label>
                  <select
                    className={`w-full border border-input rounded-md h-9 px-3 text-sm bg-background ${changed('maritalStatus', maritalStatus) ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300' : ''}`}
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
                    <Input
                      id="ben-addr"
                      className={`pl-9 ${modClass('beneficiaryAddress', beneficiaryAddress)}`}
                      value={beneficiaryAddress}
                      onChange={e => setBeneficiaryAddress(e.target.value)}
                      placeholder="Complete address"
                    />
                  </div>
                  {changed('beneficiaryAddress', beneficiaryAddress) && (
                    <p className="text-xs text-amber-600 flex items-center gap-1"><Pencil className="w-3 h-3" /> Modified</p>
                  )}
                </div>

                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label htmlFor="ben-pincode">Pincode</Label>
                  <Input
                    id="ben-pincode"
                    value={beneficiaryPincode}
                    onChange={e => setBeneficiaryPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit pincode"
                    maxLength={6}
                    className={modClass('beneficiaryPincode', beneficiaryPincode)}
                  />
                  <PincodeCheck
                    pincode={beneficiaryPincode}
                    onCheck={(serviceable, zone) => {
                      if (serviceable && zone) {
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
                    <Input
                      id="ben-city"
                      className={`pl-9 ${modClass('beneficiaryCity', beneficiaryCity)}`}
                      value={beneficiaryCity}
                      onChange={e => setBeneficiaryCity(e.target.value)}
                      placeholder="City"
                    />
                  </div>
                </div>

                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label htmlFor="ben-state">State</Label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="ben-state"
                      className={`pl-9 ${modClass('beneficiaryState', beneficiaryState)}`}
                      value={beneficiaryState}
                      onChange={e => setBeneficiaryState(e.target.value)}
                      placeholder="State"
                    />
                  </div>
                </div>

                <div className="space-y-1 col-span-2">
                  <Label htmlFor="ben-rel">Relationship to Subscriber</Label>
                  <Select value={relationship} onValueChange={setRelationship}>
                    <SelectTrigger id="ben-rel" className={changed('relationship', relationship) ? 'border-amber-400 ring-1 ring-amber-300' : ''}>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATIONSHIPS.map(rel => (
                        <SelectItem key={rel} value={rel}>{rel}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                  {medicalConditions.map((conditionItem: any, idx: number) => {
                    const condText = typeof conditionItem === 'string'
                      ? conditionItem
                      : (conditionItem?.name || conditionItem?.condition?.name || 'Condition');
                    return (
                      <Badge
                        key={`${condText}-${idx}`}
                        variant="secondary"
                        className="bg-orange-50 text-orange-700 hover:bg-orange-100 border-none py-1.5 px-3 flex items-center gap-2 rounded-lg"
                      >
                        {condText}
                        <span
                          role="button"
                          tabIndex={0}
                          className="cursor-pointer hover:text-orange-900 p-0.5 inline-flex items-center justify-center rounded-full hover:bg-orange-200/50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMedicalConditions(medicalConditions.filter(c => c !== conditionItem));
                          }}
                        >
                          <X className="w-3 h-3" />
                        </span>
                      </Badge>
                    );
                  })}
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-primary" /> Current Medications
                    </Label>
                    <Dialog open={isMedDialogOpen} onOpenChange={(open) => {
                      setIsMedDialogOpen(open);
                      if (!open) { setMedName(''); setMedDosage(''); setMedFrequency('once_daily'); setMedSlots(['morning']); setMedInstructions(''); setMedStartDate(new Date().toISOString().split('T')[0]); setMedEndDate(''); setMedReminders(false); }
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
                          if (!medName.trim()) { toast.error('Medication name is required'); return; }
                          if (medFrequency === 'once_daily' && medSlots.length !== 1) { toast.error('Please select exactly 1 time slot for Once Daily'); return; }
                          if (medFrequency === 'twice_daily' && medSlots.length !== 2) { toast.error('Please select exactly 2 time slots for Twice Daily'); return; }
                          if (medFrequency === 'thrice_daily' && medSlots.length !== 3) { toast.error('Please select all 3 time slots for Thrice Daily'); return; }
                          const newMed = { name: medName.trim(), dosage: medDosage, frequency: medFrequency, timeSlots: medSlots, setReminders: medReminders, startDate: medStartDate, endDate: medEndDate || undefined, instructions: medInstructions };
                          setMedications([...medications, newMed]);
                          setIsMedDialogOpen(false);
                        }}>
                          <div className="space-y-2">
                            <Label>Medication Name</Label>
                            <Input name="name" placeholder="e.g., Amoxicillin" required value={medName} onChange={(e) => setMedName(e.target.value)} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Dosage</Label>
                              <Input name="dosage" placeholder="250mg" value={medDosage} onChange={(e) => setMedDosage(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label>Frequency</Label>
                              <Select name="frequency" value={medFrequency} onValueChange={handleFrequencyChange}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
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
                            <Input name="instructions" placeholder="e.g., Take after food" value={medInstructions} onChange={(e) => setMedInstructions(e.target.value)} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Start Date</Label>
                              <Input name="startDate" type="date" value={medStartDate} onChange={(e) => setMedStartDate(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label>End Date (Optional)</Label>
                              <Input name="endDate" type="date" value={medEndDate} onChange={(e) => setMedEndDate(e.target.value)} />
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
                                        isChecked ? 'bg-orange-500 text-white border-orange-500 font-semibold' : 'border-border text-muted-foreground hover:bg-secondary/20'
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
                            <Switch checked={medReminders} onCheckedChange={setMedReminders} />
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
                            <p className="text-[10px] text-muted-foreground">{m.dosage} • {m.frequency?.replace('_', ' ')}</p>
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
                    <Input
                      value={primaryPhysicianName}
                      onChange={e => setPrimaryPhysicianName(e.target.value)}
                      placeholder="Dr. Name"
                      className={`h-9 ${modClass('primaryPhysicianName', primaryPhysicianName)}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Physician Phone Number</Label>
                    <Input
                      value={primaryPhysicianPhone}
                      onChange={e => setPrimaryPhysicianPhone(e.target.value)}
                      placeholder="Contact number"
                      className={`h-9 ${modClass('primaryPhysicianPhone', primaryPhysicianPhone)}`}
                    />
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
                                setHobbiesInterests(hobbiesInterests.filter(h => dbHobbies.includes(h) && h !== 'Other'));
                              } else {
                                setHobbiesInterests(hobbiesInterests.filter(h => h !== hobby));
                              }
                            } else {
                              setHobbiesInterests([...hobbiesInterests, hobby]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            isSelected ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-gray-600 border-[#E7DED6] hover:border-primary'
                          }`}
                        >
                          {hobby}
                        </button>
                      );
                    })}
                  </div>

                  {hobbiesInterests.filter(h => !dbHobbies.includes(h) && h !== 'Other').length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 animate-in fade-in slide-in-from-top-1">
                      {hobbiesInterests.filter(h => !dbHobbies.includes(h) && h !== 'Other').map((customHobbyItem) => (
                        <Badge key={customHobbyItem} variant="secondary" className="bg-orange-50 text-orange-700 hover:bg-orange-100 border-none py-1.5 px-3 flex items-center gap-2 rounded-lg text-xs">
                          {customHobbyItem}
                          <span
                            role="button"
                            tabIndex={0}
                            className="cursor-pointer hover:text-orange-900 p-0.5 inline-flex items-center justify-center rounded-full hover:bg-orange-200/50"
                            onClick={(e) => { e.stopPropagation(); setHobbiesInterests(hobbiesInterests.filter(h => h !== customHobbyItem)); }}
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
                    <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] px-2 text-primary hover:text-primary-foreground border-primary/20 hover:border-primary"
                      onClick={() => { const all: Record<string, boolean> = {}; availableVitals.forEach(v => { all[v.code] = true; }); setVitalsToTrack(all); }}>
                      Check All
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] px-2 text-muted-foreground border-border hover:bg-secondary/50"
                      onClick={() => { const none: Record<string, boolean> = {}; availableVitals.forEach(v => { none[v.code] = false; }); setVitalsToTrack(none); }}>
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
                  <div className="col-span-2 py-4 text-center text-xs text-muted-foreground italic">No vitals defined</div>
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
                    <Input
                      value={emergencyContactName}
                      onChange={e => setEmergencyContactName(e.target.value)}
                      placeholder="Name"
                      className={modClass('emergencyContactName', emergencyContactName)}
                    />
                    {changed('emergencyContactName', emergencyContactName) && (
                      <p className="text-xs text-amber-600 flex items-center gap-1"><Pencil className="w-3 h-3" /> Changed from: {original.emergencyContactName}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Phone Number *</Label>
                    <Input
                      value={emergencyContactPhone}
                      onChange={e => setEmergencyContactPhone(e.target.value)}
                      placeholder="10-digit number"
                      className={modClass('emergencyContactPhone', emergencyContactPhone)}
                    />
                    {changed('emergencyContactPhone', emergencyContactPhone) && (
                      <p className="text-xs text-amber-600 flex items-center gap-1"><Pencil className="w-3 h-3" /> Changed from: {original.emergencyContactPhone}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Relationship</Label>
                    <Input
                      value={emergencyContactRel}
                      onChange={e => setEmergencyContactRel(e.target.value)}
                      placeholder="e.g. Son"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input
                      value={emergencyContactEmail}
                      onChange={e => setEmergencyContactEmail(e.target.value)}
                      placeholder="email@ext.com"
                    />
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
              <CardDescription>Select the renewal package and renewal start date</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Renewal Mode */}
              <div className="space-y-2">
                <Label>Renewal Start</Label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
                  <button
                    type="button"
                    onClick={() => setRenewalMode('from_expiry')}
                    className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${renewalMode === 'from_expiry' ? 'bg-primary text-white shadow' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Calendar className="w-4 h-4" />
                    From Expiry ({currentExpiryDate || '—'})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenewalMode('today')}
                    className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${renewalMode === 'today' ? 'bg-amber-500 text-white shadow' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Clock className="w-4 h-4" />
                    Renew Today
                  </button>
                </div>
                {renewalMode === 'today' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex gap-2 items-start">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span><strong>Renew Today:</strong> New subscription starts immediately from today. There may be a gap or overlap with the current subscription if it hasn't expired yet.</span>
                  </div>
                )}
              </div>

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
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${selectedPackageId === pkg.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'} ${pkg.id === original.selectedPackageId ? '' : selectedPackageId === pkg.id ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{pkg.name}</p>
                          {pkg.id !== original.selectedPackageId && selectedPackageId === pkg.id && (
                            <Badge className="text-[9px] bg-amber-100 text-amber-700 border-amber-300 border h-4 px-1.5">CHANGED</Badge>
                          )}
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
                          className={`h-9 text-xs ${changed('duration', duration) && duration === d.value ? 'ring-2 ring-amber-400' : ''}`}
                        >
                          {d.label}
                        </Button>
                      ))}
                    </div>
                    {changed('duration', duration) && (
                      <p className="text-xs text-amber-600 flex items-center gap-1"><Pencil className="w-3 h-3" /> Changed from: {original.duration?.replace('_', ' ')}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-primary" /> Renewal Start Date
                      </Label>
                      <div className="h-10 px-3 border border-border bg-slate-50 text-slate-600 rounded-md text-xs flex items-center font-mono">
                        {computeStartDate() || 'N/A'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3 text-muted-foreground" /> Suggested End Date
                      </Label>
                      <div className="h-10 px-3 border border-border bg-slate-50 text-slate-500 rounded-md text-xs flex items-center font-mono">
                        {getSuggestedEndDate(computeStartDate(), duration) || 'N/A'}
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
                        <p className="text-[10px] text-muted-foreground">Attach extra services or care visits to this renewal</p>
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
              <CardDescription>Collect offline payment or generate an online Razorpay payment link for customer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedPackage && (
                <div className="bg-secondary/40 rounded-xl p-4 space-y-3 mb-2 border border-slate-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-base text-slate-900">{pricing.packageName || selectedPackage.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {duration.replace('_', ' ')} plan ({pricing.months} mo) · starts {computeStartDate()}
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
                  toast.success('Online Payment Verified & Renewal Activated! 🎉');
                }}
                onGenerateLink={async () => {
                  setGeneratingLink(true);
                  try {
                    const res = await paymentApi.generateLink({
                      subscriberId: original.subscriberId || '',
                      beneficiaryId: original.beneficiaryId || '',
                      subscriptionId: original.subscriptionId || subscriptionId || '',
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
                      toast.success('Payment Link generated successfully!');
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

        {/* ── Summary Preview on Payment step ── */}
        {step === 'payment' && canProceedPayment && (
          <Card className="mt-4 border-dashed bg-secondary/20">
            <CardContent className="p-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Renewal Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subscriber</span><span className="font-medium">{subscriberName} ({subscriberPhone})</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Beneficiary</span><span className="font-medium">{beneficiaryName}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Package</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{selectedPackage?.name}</span>
                    {selectedPackage?.id !== original.selectedPackageId && (
                      <Badge className="text-[8px] bg-amber-100 text-amber-700 border-amber-300 border h-3.5 px-1">CHANGED</Badge>
                    )}
                  </div>
                </div>
                {selectedAddons.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Add-ons</span>
                    <span className="font-medium text-[#FF7A00]">{selectedAddons.map(a => `${a.benefit.name} (${a.units}u)`).join(', ')}</span>
                  </div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Start Date</span><span className="font-medium">{computeStartDate()}</span></div>
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
                (step === 'emergency' && (!emergencyContactName || !emergencyContactPhone)) ||
                (step === 'package' && !canProceedPackage)
              }
              className="bg-primary"
            >
              Next <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleRenew}
              disabled={!canProceedPayment || renewing}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {renewing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {renewing ? 'Renewing...' : 'Renew Subscription'}
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
        defaultPincode={beneficiaryPincode}
        standaloneSelectMode={true}
        onSelectAddonForWizard={(newAddon) => {
          setSelectedAddons(prev => [...prev, newAddon]);
          toast.success(`Added "${newAddon.benefit.name}" to renewal!`);
        }}
      />
    </div>
  );
}
