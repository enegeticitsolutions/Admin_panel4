import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Alert, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GlobalHeader } from '../../components/GlobalHeader';
import { Image } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AddressPicker } from '../../components/ui/AddressPicker';
import { AddonCard } from '@/components/addons/AddonCard';
import * as Location from 'expo-location';
import { serviceabilityService } from '@/services/serviceability.service';
import { getAccurateLocation } from '@/services/location';

type PlanDuration = 'basic' | '6months' | 'annual';

import { API_URL } from '@/constants/api';
import { CallbackButton } from '../../components/CallbackButton';
import { useSafeBack } from '@/hooks/useSafeBack';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';

export default function SubscriptionPackagesScreen() {
    const router = useRouter();
    const { push } = useNavigationStack();
    const safeBack = useSafeBack();
    useAndroidBackHandler();
    const { role, isLoggedIn } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
    const [packages, setPackages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Location targeting states
    const [selectedAddress, setSelectedAddress] = useState('');
    const [selectedPincode, setSelectedPincode] = useState('');
    const [selectedRegionId, setSelectedRegionId] = useState('');
    const [selectedLat, setSelectedLat] = useState<number | null>(null);
    const [selectedLng, setSelectedLng] = useState<number | null>(null);
    const [selectedCycle, setSelectedCycle] = useState<string>('3');

    const [mapModalVisible, setMapModalVisible] = useState(false);

    // Add-on selection step modal states
    const [showAddonSelectionModal, setShowAddonSelectionModal] = useState(false);
    const [selectedPackageForAddons, setSelectedPackageForAddons] = useState<any | null>(null);
    const [availableAddonsForPackage, setAvailableAddonsForPackage] = useState<any[]>([]);
    const [loadingAddons, setLoadingAddons] = useState(false);
    const [selectedAddonsMap, setSelectedAddonsMap] = useState<{ [benefitId: string]: { benefitId: string; name: string; unitLabel?: string; quantity: number; unitPrice: number; includedUnits: number } }>({});

    const [checkingPin, setCheckingPin] = useState(false);
    const [serviceMessage, setServiceMessage] = useState('');
    const [isServiceable, setIsServiceable] = useState<boolean | null>(null);

    const handleCheckLocation = async (lat?: number, lng?: number, pincode?: string) => {
        setCheckingPin(true);
        setServiceMessage('');
        setIsServiceable(null);
        try {
            const result = await serviceabilityService.checkLocation(lat, lng, pincode);
            
            if (result.isServiceable) {
                const regionId = result.region?.id || '';
                setServiceMessage(result.message || `Serving ${result.location}! Showing targeted packages.`);
                setIsServiceable(true);
                setSelectedAddress(result.location || `Pincode ${pincode || ''}`);
                if (pincode) setSelectedPincode(pincode);
                setSelectedRegionId(regionId);
                if (lat !== undefined && lng !== undefined) {
                    setSelectedLat(lat);
                    setSelectedLng(lng);
                }
                
                // Reload packages for this region
                const pkgRes = await fetch(`${API_URL}/subscriber/subscriptions/packages?regionId=${regionId}`);
                const pkgJson = await pkgRes.json();
                if (pkgJson.success) {
                    setPackages(pkgJson.data);
                }
            } else {
                setServiceMessage(result.message || "We don't serve this location yet. Showing global packages only.");
                setIsServiceable(false);
                setSelectedAddress(result.location || `Pincode ${pincode || ''}`);
                if (pincode) setSelectedPincode(pincode);
                setSelectedRegionId('');
                if (lat !== undefined && lng !== undefined) {
                    setSelectedLat(lat);
                    setSelectedLng(lng);
                }
                // Load global packages only
                const pkgRes = await fetch(`${API_URL}/subscriber/subscriptions/packages`);
                const pkgJson = await pkgRes.json();
                if (pkgJson.success) {
                    setPackages(pkgJson.data);
                }
            }
        } catch (err) {
            console.error("Error checking location:", err);
            Alert.alert("Error", "Could not check location serviceability.");
        } finally {
            setCheckingPin(false);
        }
    };

    const handleDirectDetectLocation = async () => {
        setCheckingPin(true);
        setServiceMessage('');
        setIsServiceable(null);
        try {
            const loc = await getAccurateLocation();
            const resolvedAddress = loc.address || [loc.city, loc.state].filter(Boolean).join(', ') || 'Current Location';
            setSelectedAddress(resolvedAddress);
            if (loc.pincode) setSelectedPincode(loc.pincode);
            
            await handleCheckLocation(loc.latitude, loc.longitude, loc.pincode);
        } catch (err) {
            console.error("Direct detect location failed:", err);
            Alert.alert("Error", "Failed to auto-detect your location. Please select it on the map.");
            setCheckingPin(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            try {
                // Check auth status
                const token = await AsyncStorage.getItem('userToken');
                let userPincode = '';
                let defaultLat = 28.6139;
                let defaultLng = 77.2090;
                let hasCoords = false;

                if (token) {


                    // Load user profile to check for default coordinates
                    try {
                        const profileRes = await fetch(`${API_URL}/subscriber/profile`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        const profileJson = await profileRes.json();
                        if (profileJson.success && profileJson.data?.user) {
                            const u = profileJson.data.user;
                            if (u.latitude && u.longitude) {
                                defaultLat = u.latitude;
                                defaultLng = u.longitude;
                                hasCoords = true;
                            } else if (u.pincode) {
                                userPincode = u.pincode;
                            }
                        }
                    } catch (e) {
                        console.warn('Profile fetch failed:', e);
                    }
                }

                if (hasCoords) {
                    await handleCheckLocation(defaultLat, defaultLng);
                } else if (userPincode) {
                    await handleCheckLocation(undefined, undefined, userPincode);
                } else {
                    // Fetch available packages globally
                    const response = await fetch(`${API_URL}/subscriber/subscriptions/packages`);
                    const json = await response.json();
                    if (json.success) {
                        setPackages(json.data);
                    }
                }
            } catch (err) {
                console.error('Failed to initialize packages screen:', err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const fetchAddonsForSelection = async (regionId: string) => {
        setLoadingAddons(true);
        try {
            const token = await AsyncStorage.getItem('userToken');
            const query = regionId ? `?regionId=${regionId}` : '';
            const res = await fetch(`${API_URL}/subscriber/subscriptions/addons/available${query}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            if (json.success) {
                setAvailableAddonsForPackage(json.data || []);
            }
        } catch (e) {
            console.warn('Failed to fetch addons:', e);
        } finally {
            setLoadingAddons(false);
        }
    };

    const handleSelectPackage = async (packageType: string) => {
        // Check if user is logged in
        const token = await AsyncStorage.getItem('userToken');
        if (!token) {
            Alert.alert(
                "Login Required",
                "Please login first to select a package.",
                [
                    {
                        text: "Login",
                        onPress: () => router.push({ pathname: '/(auth)', params: { message: 'Please login first to select a package.' } })
                    },
                    {
                        text: "Cancel",
                        style: "cancel"
                    }
                ]
            );
            return;
        }

        // Find the full package object
        const selectedPkg = packages.find(p => p.type === packageType);
        if (!selectedPkg) {
            Alert.alert("Error", "Package not found.");
            return;
        }

        setSelectedPackageForAddons(selectedPkg);
        setSelectedAddonsMap({});
        setShowAddonSelectionModal(true);
        await fetchAddonsForSelection(selectedRegionId);
    };

    const handleAddonQuantityChange = (addon: any, delta: number) => {
        const current = selectedAddonsMap[addon.id];
        const currentQty = current ? current.quantity : 0;
        const newQty = currentQty + delta;

        if (newQty <= 0) {
            const updated = { ...selectedAddonsMap };
            delete updated[addon.id];
            setSelectedAddonsMap(updated);
        } else {
            const unitP = addon.addonDiscountPrice ?? addon.addonPrice ?? 0;
            const incUnits = addon.addonIncludedUnits ?? 1;
            setSelectedAddonsMap({
                ...selectedAddonsMap,
                [addon.id]: {
                    benefitId: addon.id,
                    name: addon.name,
                    unitLabel: addon.unitLabel,
                    quantity: newQty,
                    unitPrice: unitP,
                    includedUnits: incUnits * newQty
                }
            });
        }
    };

    const handleProceedToCheckout = () => {
        if (!selectedPackageForAddons) return;

        const selectedAddonsPayload = Object.values(selectedAddonsMap);

        setShowAddonSelectionModal(false);

        // For trial packages, duration is fixed by trialDurationDays on the backend.
        // Pass durationMonths=1 as a safe default; the API will use days instead.
        const effectiveDuration = selectedPackageForAddons.isFreeTrial ? '1' : selectedCycle;

        push('/(setup)/checkout', { 
            packageId: selectedPackageForAddons.id, 
            serviceRegionId: selectedRegionId,
            servicePincode: selectedPincode,
            serviceAddress: JSON.stringify(selectedAddress),
            serviceLat: selectedLat ? String(selectedLat) : '',
            serviceLng: selectedLng ? String(selectedLng) : '',
            selectedAddons: JSON.stringify(selectedAddonsPayload),
            // Duration: number of months selected on the packages screen (1 for trial packages)
            durationMonths: effectiveDuration,
        });
    };

    const calculatePackagePrice = (pkg: any, cycleKey: string) => {
        if (!pkg) return 0;
        const base = pkg.basePrice || 0;
        const durNum = parseInt(cycleKey, 10);
        if (durNum === 3) {
            const disc = pkg.discountThreeMonths ?? 5;
            return pkg.priceThreeMonths ? pkg.priceThreeMonths : Math.round(base * 3 * (1 - disc / 100));
        } else if (durNum === 6) {
            const disc = pkg.discountSixMonths ?? 10;
            return pkg.priceSixMonths ? pkg.priceSixMonths : Math.round(base * 6 * (1 - disc / 100));
        } else if (durNum === 12) {
            const disc = pkg.discountAnnual ?? 20;
            return pkg.priceTwelveMonths ? pkg.priceTwelveMonths : Math.round(base * 12 * (1 - disc / 100));
        }
        return base;
    };

    const getPrice = (pkg: any) => {
        return calculatePackagePrice(pkg, selectedCycle);
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <GlobalHeader title="Subscription Packages" />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#F97316" />
                </View>
            </SafeAreaView>
        );
    }

    const discount6m = packages[0]?.discountSixMonths || 10;
    const discountAnnual = packages[0]?.discountAnnual || 20;

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.headerWrapper}>
                <View style={styles.headerContainer}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => safeBack()}>
                        <Ionicons name="arrow-back" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Subscription Packages</Text>

                    {/* Hamburger menu — navigate without buying a package */}
                    <TouchableOpacity
                        style={styles.menuBtn}
                        onPress={() => setMenuOpen(v => !v)}
                    >
                        <Ionicons name="menu" size={26} color="#111827" />
                    </TouchableOpacity>
                </View>

                {/* Dropdown */}
                {menuOpen && (
                    <View style={styles.menuDropdown}>
                        {isLoggedIn ? (
                            <>
                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => { setMenuOpen(false); router.replace('/(subscriber)' as any); }}
                                >
                                    <Ionicons name="home-outline" size={20} color="#111827" />
                                    <Text style={styles.menuItemText}>Dashboard</Text>
                                </TouchableOpacity>
                                <View style={styles.menuDivider} />
                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => { setMenuOpen(false); router.push('/(subscriber)/profile' as any); }}
                                >
                                    <Ionicons name="person-outline" size={20} color="#111827" />
                                    <Text style={styles.menuItemText}>My Profile</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <TouchableOpacity
                                style={[styles.menuItem, { backgroundColor: '#F97316', justifyContent: 'center' }]}
                                onPress={() => { setMenuOpen(false); router.push('/(auth)' as any); }}
                            >
                                <Text style={[styles.menuItemText, { color: '#FFFFFF', fontWeight: 'bold' }]}>Login</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                <View style={styles.headerArea}>
                    <Text style={styles.mainTitle}>Choose the Right Care for Your Loved Ones</Text>
                    <Text style={styles.subTitle}>Personalized plans designed for peace of mind.</Text>
                </View>

                {/* Google Maps Location Pick Box */}
                <View style={styles.locationContainer}>
                    <Text style={styles.locationTitle}>See packages serving in desired location</Text>
                    {selectedAddress ? (
                        <View style={styles.selectedLocationBox}>
                            <Ionicons name="location" size={18} color="#FE6700" style={{ marginRight: 6 }} />
                            <Text style={styles.selectedAddressText} numberOfLines={2}>
                                {selectedAddress}
                            </Text>
                        </View>
                    ) : (
                        <Text style={styles.noLocationText}>No location selected yet.</Text>
                    )}
                    
                    <View style={styles.actionButtonRow}>
                        <TouchableOpacity 
                            style={styles.detectLocationBtn} 
                            onPress={handleDirectDetectLocation}
                            disabled={checkingPin}
                        >
                            <Ionicons name="locate-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
                            <Text style={styles.pickLocationBtnText}>Detect Location</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.pickLocationBtn} 
                            onPress={() => setMapModalVisible(true)}
                        >
                            <Ionicons name="map-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
                            <Text style={styles.pickLocationBtnText}>Pick on Map</Text>
                        </TouchableOpacity>
                    </View>

                    {serviceMessage ? (
                        <Text style={[
                            styles.serviceMessage, 
                            isServiceable ? styles.serviceSuccess : styles.serviceFail
                        ]}>
                            {serviceMessage}
                        </Text>
                    ) : null}
                </View>

                {/* Duration Cycle Selector Toggle Bar */}
                <View style={{
                    flexDirection: 'row',
                    backgroundColor: '#F1F5F9',
                    borderRadius: 14,
                    padding: 4,
                    marginBottom: 20,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                }}>
                    {[
                        { key: '3', label: '3 Months', badge: '5% OFF' },
                        { key: '6', label: '6 Months', badge: '10% OFF' },
                        { key: '12', label: '1 Year', badge: '20% OFF' },
                    ].map((item) => {
                        const isActive = selectedCycle === item.key;
                        return (
                            <TouchableOpacity
                                key={item.key}
                                onPress={() => setSelectedCycle(item.key)}
                                style={{
                                    flex: 1,
                                    paddingVertical: 10,
                                    borderRadius: 10,
                                    backgroundColor: isActive ? '#FE6700' : 'transparent',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Text style={{
                                    fontSize: 12,
                                    fontWeight: '800',
                                    color: isActive ? '#FFFFFF' : '#1E293B',
                                }}>
                                    {item.label}
                                </Text>
                                {item.badge ? (
                                    <Text style={{
                                        fontSize: 9,
                                        fontWeight: '700',
                                        color: isActive ? '#FFE4CC' : '#16A34A',
                                        marginTop: 2,
                                    }}>
                                        {item.badge}
                                    </Text>
                                ) : null}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Dynamic DB Driven Cards */}
                {packages.map((pkg: any) => {
                    const isPopular = pkg.isPopular;
                    const isRegional = !pkg.isGlobal;
                    const isTrial = !!pkg.isFreeTrial;

                    const base = pkg.basePrice || 0;
                    const durNum = parseInt(selectedCycle, 10);
                    let displayPrice = base;
                    let cycleSubtext = '/ month';

                    if (isTrial) {
                        // Trial packages: show flat price, ignore the cycle selector
                        displayPrice = base;
                        cycleSubtext = `/ ${pkg.trialDurationDays ?? 7} days`;
                    } else if (durNum === 3) {
                        const disc = pkg.discountThreeMonths ?? 5;
                        displayPrice = pkg.priceThreeMonths ? pkg.priceThreeMonths : Math.round(base * 3 * (1 - disc / 100));
                        const monthly = Math.round(displayPrice / 3);
                        cycleSubtext = `(₹${monthly.toLocaleString('en-IN')}/mo for 3 mo)`;
                    } else if (durNum === 6) {
                        const disc = pkg.discountSixMonths ?? 10;
                        displayPrice = pkg.priceSixMonths ? pkg.priceSixMonths : Math.round(base * 6 * (1 - disc / 100));
                        const monthly = Math.round(displayPrice / 6);
                        cycleSubtext = `(₹${monthly.toLocaleString('en-IN')}/mo for 6 mo)`;
                    } else if (durNum === 12) {
                        const disc = pkg.discountAnnual ?? 20;
                        displayPrice = pkg.priceTwelveMonths ? pkg.priceTwelveMonths : Math.round(base * 12 * (1 - disc / 100));
                        const monthly = Math.round(displayPrice / 12);
                        cycleSubtext = `(₹${monthly.toLocaleString('en-IN')}/mo for 1 yr)`;
                    }

                    return (
                        <View key={pkg.id} style={[
                            styles.card,
                            isPopular && styles.popularCard,
                            isRegional && styles.regionalCard,
                            isTrial && { borderColor: '#A855F7', borderWidth: 1.5 },
                        ]}>
                            {isTrial && (
                                <View style={{
                                    position: 'absolute', top: 0, left: 0, right: 0,
                                    backgroundColor: '#7C3AED', borderTopLeftRadius: 12, borderTopRightRadius: 12,
                                    paddingVertical: 5, alignItems: 'center',
                                }}>
                                    <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>
                                        🧪 {pkg.trialDurationDays ?? 7}-DAY TRIAL
                                    </Text>
                                </View>
                            )}
                            {!isTrial && isPopular && (
                                <View style={styles.popularBadge}>
                                    <Ionicons name="star" size={12} color="#FFF" style={{ marginRight: 4 }} />
                                    <Text style={styles.popularBadgeText}>Most Popular</Text>
                                </View>
                            )}

                            {isRegional && (
                                <View style={styles.regionalBadge}>
                                    <Ionicons name="location" size={12} color="#FFF" style={{ marginRight: 4 }} />
                                    <Text style={styles.regionalBadgeText}>Local Plan</Text>
                                </View>
                            )}

                            <View style={[styles.cardHeaderRow, isTrial && { paddingTop: 28 }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.planName}>{pkg.name}</Text>
                                    <View style={styles.priceRow}>
                                        <Text style={isTrial ? { fontSize: 22, fontWeight: '800', color: '#7C3AED' } : (isRegional ? styles.planPriceRegional : (isPopular ? styles.planPriceColor : styles.planPrice))}>
                                            ₹{displayPrice.toLocaleString('en-IN')}
                                        </Text>
                                        <Text style={{ fontSize: 11, color: isTrial ? '#7C3AED' : '#6B7280', fontWeight: '600', marginLeft: 4, alignSelf: 'center' }}>
                                            {cycleSubtext}
                                        </Text>
                                    </View>
                                </View>
                                <Image
                                    source={
                                        pkg.type?.includes("silver")
                                            ? require("../../assets/images/group1.png")
                                            : pkg.type?.includes("gold")
                                                ? require("../../assets/images/group2.png")
                                                : require("../../assets/images/group3.png")
                                    }
                                    style={{ width: 70, height: 70 }}
                                />
                            </View>

                            <View style={styles.featureList}>
                                {(pkg.packageBenefits || []).map((pb: any, fIdx: number) => {
                                    const rawLabel = (pb.benefit?.unitLabel || '').replace(/^per\s+/i, '').trim();
                                    const formattedLabel = rawLabel ? ' ' + rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1).toLowerCase() + (pb.unitsIncluded > 1 && !rawLabel.toLowerCase().endsWith('s') ? 's' : '') : '';
                                    
                                    const rawName = pb.benefit?.name || '';
                                    const formattedName = rawName.replace(/\b\w/g, (char: string) => char.toUpperCase()).replace(/\B\w/g, (char: string) => char.toLowerCase());

                                    const baseUnit = pb.unitsIncluded ?? 0;
                                    const period = pb.unitsPeriod || 'monthly';
                                    let periodText = "";
                                    if (period === "monthly") periodText = "/month";
                                    else if (period === "yearly") periodText = "/year";
                                    else if (period === "3_months") periodText = "/quarter";
                                    else if (period === "6_months") periodText = "/half-year";
                                    else if (period === "one_time") periodText = " (once)";

                                    return (
                                        <View key={fIdx} style={styles.featureRow}>
                                            <Ionicons name="checkmark-circle" size={18} color={isRegional ? "#F97316" : "#0D9488"} />
                                            <Text style={styles.featureText}>
                                                {pb.showUnit !== false ? (
                                                    <Text style={{ fontWeight: '800', color: '#111827' }}>
                                                        {pb.isUnlimited ? 'Unlimited' : `${baseUnit}${formattedLabel}${periodText}`}{' • '}
                                                    </Text>
                                                ) : null}
                                                {formattedName}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>

                            <View style={styles.cardActions}>
                                <TouchableOpacity
                                    style={[styles.detailsBtn, isRegional && styles.detailsBtnRegional]}
                                    onPress={() => router.push({ pathname: `/(subscriber)/package-details/${pkg.type}`, params: { cycle: selectedCycle } })}

                                >
                                    <Text style={[styles.detailsBtnText, isRegional && styles.detailsBtnTextRegional]}>View Details</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[isPopular ? styles.selectBtnSolid : styles.selectBtnOutline, isRegional && (isPopular ? styles.selectBtnSolidRegional : styles.selectBtnOutlineRegional)]}
                                    onPress={() => handleSelectPackage(pkg.type)}
                                >
                                    <Text style={isPopular ? styles.selectBtnSolidText : (isRegional ? styles.selectBtnOutlineTextRegional : styles.selectBtnOutlineText)}>
                                        Select
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })}



                {/* How It Works Section */}
                <View style={styles.howItWorksContainer}>
                    <Text style={styles.sectionTitle}>How It Works</Text>

                    <View style={styles.stepContainer}>
                        <View style={styles.stepBadge}><Text style={styles.stepNumber}>1</Text></View>
                        <Text style={styles.stepTitle}>Choose Package</Text>
                        <Text style={styles.stepSub}>Select the care plan that suits your needs</Text>
                    </View>

                    <View style={styles.stepContainer}>
                        <View style={styles.stepBadge}><Text style={styles.stepNumber}>2</Text></View>
                        <Text style={styles.stepTitle}>Add Details</Text>
                        <Text style={styles.stepSub}>Provide beneficiary and medical information</Text>
                    </View>

                    <View style={styles.stepContainer}>
                        <View style={styles.stepBadge}><Text style={styles.stepNumber}>3</Text></View>
                        <Text style={styles.stepTitle}>Schedule Visits</Text>
                        <Text style={styles.stepSub}>Set preferred timings for care companion visits</Text>
                    </View>

                    <View style={styles.stepContainer}>
                        <View style={styles.stepBadge}><Text style={styles.stepNumber}>4</Text></View>
                        <Text style={styles.stepTitle}>Start Care</Text>
                        <Text style={styles.stepSub}>Begin receiving professional care services</Text>
                    </View>
                </View>

                {/* Need Assistance Section */}
                <View style={styles.assistanceCard}>
                    <View style={styles.assistanceHeader}>
                        <View style={styles.assistanceIllustration}>
                            <Image
                                source={require("../../assets/images/group4.png")}
                                style={{ width: 50, height: 50 }}
                            />
                        </View>
                        <View style={{ flex: 1, marginLeft: 15 }}>
                            <Text style={styles.assistanceTitle}>Need assistance?</Text>
                            <Text style={styles.assistanceSub}>Our experts are here to help you choose the right plan via Phone or WhatsApp.</Text>
                        </View>
                    </View>

                    <View style={styles.assistanceActions}>
                        <CallbackButton
                            style={styles.callbackBtn}
                            textStyle={styles.callbackText}
                            notes="Requested assistance from Subscription Packages page"
                        />
                        <TouchableOpacity style={styles.whatsappBtn}>
                            <Ionicons name="chatbox-ellipses-outline" size={28} color="#F97316" />
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {/* Address Picker Modal */}
            {mapModalVisible && (
                <Modal visible={mapModalVisible} animationType="slide" transparent={false}>
                    <AddressPicker
                        onAddressSelected={(selected) => {
                            setMapModalVisible(false);
                            setSelectedAddress(selected.address);
                            setSelectedPincode(selected.pincode || '');
                            setSelectedLat(selected.latitude);
                            setSelectedLng(selected.longitude);
                            handleCheckLocation(selected.latitude, selected.longitude);
                        }}
                        onCancel={() => setMapModalVisible(false)}
                        title="Set Accurate Location"
                        subtitle="Move the pin to your exact location"
                    />
                </Modal>
            )}
            {/* ── Add-ons Customization Step Modal ── */}
            <Modal
                visible={showAddonSelectionModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowAddonSelectionModal(false)}
            >
                <View style={styles.addonStepModalOverlay}>
                    <View style={styles.addonStepModalContent}>
                        {/* Header */}
                        <View style={styles.addonStepHeader}>
                            <View>
                                <Text style={styles.addonStepTitle}>Customize Your Plan</Text>
                                <Text style={styles.addonStepSubTitle}>Select optional add-on benefits for your package</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowAddonSelectionModal(false)} style={styles.closeBtnCircle}>
                                <Ionicons name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
                            {/* Selected Package Banner */}
                            {selectedPackageForAddons && (
                                <View style={styles.selectedPkgBanner}>
                                    <View style={styles.selectedPkgIconCircle}>
                                        <Ionicons name="cube-outline" size={20} color="#FF5B0A" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.selectedPkgName}>
                                            {selectedPackageForAddons.name} ({selectedCycle === '12' ? '1 Year' : selectedCycle === '6' ? '6 Months' : '3 Months'})
                                        </Text>
                                        <Text style={styles.selectedPkgBenefitsCount}>
                                            {selectedPackageForAddons.packageBenefits?.length || 3} Standard Benefits Included · ₹{calculatePackagePrice(selectedPackageForAddons, selectedCycle).toLocaleString('en-IN')}
                                        </Text>
                                    </View>
                                </View>
                            )}

                            <View style={{ marginBottom: 12 }}>
                                <Text style={styles.addonsListHeaderTitle}>Available Add-on Benefits</Text>
                                <Text style={styles.addonsListHeaderSub}>
                                    {selectedRegionId ? 'Location-matched & global add-on options' : 'Select optional benefit top-ups'}
                                </Text>
                            </View>

                            {loadingAddons ? (
                                <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                                    <ActivityIndicator size="small" color="#FF5B0A" />
                                    <Text style={{ marginTop: 8, fontSize: 13, color: '#6B7280' }}>Loading add-ons...</Text>
                                </View>
                            ) : availableAddonsForPackage.length === 0 ? (
                                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                                    <Text style={{ color: '#6B7280', fontSize: 13 }}>No add-ons available at this time.</Text>
                                </View>
                            ) : (
                                availableAddonsForPackage.map((addon) => {
                                    const currentItem = selectedAddonsMap[addon.id];
                                    const qty = currentItem ? currentItem.quantity : 0;

                                    return (
                                        <AddonCard
                                            key={addon.id}
                                            addon={addon}
                                            selectedQuantity={qty}
                                            onQuantityChange={handleAddonQuantityChange}
                                        />
                                    );
                                })
                            )}
                        </ScrollView>

                        {/* Dynamic Summary Bar & Checkout Button */}
                        {selectedPackageForAddons && (
                            <View style={styles.addonSummaryFooter}>
                                <View style={styles.summaryStatsRow}>
                                    <View style={{ flex: 1, marginRight: 10 }}>
                                        <Text style={styles.summaryBenefitsLabel}>TOTAL PACKAGE COVERAGE</Text>
                                        <Text style={styles.summaryBenefitsCount}>
                                            {(selectedPackageForAddons.packageBenefits?.length || 3) + Object.keys(selectedAddonsMap).length} Total Benefits Included
                                        </Text>
                                    </View>

                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.summaryPriceLabel}>TOTAL PRICE</Text>
                                        <Text style={styles.summaryPriceValue}>
                                            ₹{(calculatePackagePrice(selectedPackageForAddons, selectedCycle) + Object.values(selectedAddonsMap).reduce((sum: number, item: any) => sum + (item.unitPrice * item.quantity), 0)).toLocaleString('en-IN')}
                                        </Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.proceedCheckoutBtn}
                                    onPress={handleProceedToCheckout}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.proceedCheckoutBtnText}>
                                        {Object.keys(selectedAddonsMap).length > 0
                                            ? `Proceed with Add-ons (${(selectedPackageForAddons.packageBenefits?.length || 3) + Object.keys(selectedAddonsMap).length} Benefits)`
                                            : 'Proceed to Checkout'}
                                    </Text>
                                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFF5ED' },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
        marginBottom: 4,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'center' },
    menuBtn: { padding: 4 },

    headerArea: { marginBottom: 24 },
    mainTitle: { fontSize: 22, fontWeight: '400', color: '#111827', lineHeight: 30, marginBottom: 8 },
    subTitle: { fontSize: 15, color: '#4B5563' },

    toggleContainer: {
        flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 30, padding: 4,
        marginBottom: 30, borderWidth: 1, borderColor: '#FDE6D5', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4
    },
    toggleBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 26 },
    toggleBtnActive: { backgroundColor: '#F97316' },
    toggleText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
    toggleTextActive: { color: '#FFFFFF' },
    discountText: { fontSize: 9, color: '#9CA3AF' },
    discountTextActive: { fontSize: 9, color: '#FFD6BA' },

    headerWrapper: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        zIndex: 10,
    },
    menuDropdown: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        marginTop: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 6,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        gap: 14,
    },
    menuItemText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#111827',
        fontFamily: 'Poppins-Medium',
    },
    menuDivider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginHorizontal: 16,
    },

    card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    planName: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
    planPrice: { fontSize: 28, fontWeight: '800', color: '#0D9488' },
    planPriceColor: { fontSize: 28, fontWeight: '800', color: '#0D9488' },
    priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
    discountInfo: { marginBottom: 4 },
    mrpText: { fontSize: 14, color: '#9CA3AF', textDecorationLine: 'line-through', marginBottom: 2 },
    discountBadge: { backgroundColor: '#F0FDFA', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    discountBadgeText: { fontSize: 10, fontWeight: '700', color: '#0D9488' },

    illustrationPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFF5ED', alignItems: 'center', justifyContent: 'center' },
    iconCircleBasic: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
    iconCirclePremium: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFEBE0', alignItems: 'center', justifyContent: 'center' },

    hoursText: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 16 },
    featureList: { marginBottom: 24 },
    featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    featureText: { fontSize: 14, color: '#4B5563', marginLeft: 10 },

    cardActions: { flexDirection: 'row', gap: 12, marginTop: 10 },
    detailsBtn: { 
        flex: 1, borderWidth: 1, borderColor: '#0D9488', 
        borderRadius: 12, justifyContent: 'center', alignItems: 'center', height: 48 
    },
    detailsBtnText: { color: '#0D9488', fontSize: 13, fontWeight: '700' },

    selectBtnOutline: { 
        flex: 1, borderWidth: 1, borderColor: '#0D9488', height: 48, 
        borderRadius: 12, alignItems: 'center', justifyContent: 'center' 
    },
    selectBtnOutlineText: { color: '#0D9488', fontSize: 13, fontWeight: '700' },
    selectBtnSolid: { 
        flex: 1, backgroundColor: '#0D9488', height: 48, 
        borderRadius: 12, alignItems: 'center', justifyContent: 'center' 
    },
    selectBtnSolidText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

    popularCard: { borderWidth: 2, borderColor: '#0D9488', marginTop: 10 },
    popularBadge: { position: 'absolute', top: -14, alignSelf: 'center', backgroundColor: '#0D9488', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, flexDirection: 'row', alignItems: 'center' },
    popularBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },

    // How it Works Styles
    howItWorksContainer: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, marginBottom: 24 },
    sectionTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 24 },
    stepContainer: { alignItems: 'center', marginBottom: 24 },
    stepBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F97316', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    stepNumber: { color: '#FFF', fontWeight: '700', fontSize: 16 },
    stepTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
    stepSub: { fontSize: 13, color: '#6B7280', textAlign: 'center', paddingHorizontal: 20 },

    // Assistance Card Styles
    assistanceCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 20 },
    assistanceHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    assistanceIllustration: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
    assistanceTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 },
    assistanceSub: { fontSize: 16, color: '#4B5563', lineHeight: 18 },
    assistanceActions: { flexDirection: 'row', alignItems: 'center' },
    callbackBtn: { flex: 1, flexDirection: 'row', borderWidth: 1, borderColor: '#F97316', borderRadius: 12, height: 50, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
    callbackText: { color: '#F97316', fontWeight: '600', fontSize: 15 },
    whatsappBtn: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },

    // Location picker styles
    locationContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#FDE6D5',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2
    },
    locationTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12
    },
    selectedLocationBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF5ED',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#FDE6D5'
    },
    selectedAddressText: {
        fontSize: 13,
        color: '#4B5563',
        flex: 1,
        lineHeight: 18
    },
    noLocationText: {
        fontSize: 13,
        color: '#9CA3AF',
        marginBottom: 12,
        fontStyle: 'italic'
    },
    actionButtonRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12
    },
    detectLocationBtn: {
        flex: 1,
        backgroundColor: '#10B981',
        borderRadius: 12,
        height: 48,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pickLocationBtn: {
        flex: 1,
        backgroundColor: '#F97316',
        borderRadius: 12,
        height: 48,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pickLocationBtnText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 14
    },
    serviceMessage: {
        fontSize: 13,
        fontWeight: '600',
        marginTop: 10
    },
    serviceSuccess: {
        color: '#10B981'
    },
    serviceFail: {
        color: '#EF4444'
    },

    // Regional package styles
    regionalCard: {
        borderColor: '#F97316',
        borderWidth: 1.5,
        backgroundColor: '#FFF5ED'
    },
    regionalBadge: {
        position: 'absolute',
        top: -14,
        alignSelf: 'center',
        backgroundColor: '#F97316',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center'
    },
    regionalBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700'
    },
    planPriceRegional: {
        fontSize: 28,
        fontWeight: '800',
        color: '#F97316'
    },
    selectBtnSolidRegional: {
        backgroundColor: '#F97316'
    },
    selectBtnOutlineRegional: {
        borderColor: '#F97316'
    },
    selectBtnOutlineTextRegional: {
        color: '#F97316'
    },
    detailsBtnTextRegional: {
        color: '#F97316'
    },
    detailsBtnRegional: {
        borderColor: '#F97316'
    },

    // Add-on selection modal styles (Minimalist Design)
    addonStepModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'flex-end'
    },
    addonStepModalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '85%',
        paddingTop: 20,
        paddingHorizontal: 20,
        paddingBottom: 10,
    },
    addonStepHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        paddingBottom: 14,
        marginBottom: 16
    },
    addonStepTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
    },
    addonStepSubTitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2
    },
    closeBtnCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    selectedPkgBanner: {
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    selectedPkgIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#FFF3ED',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12
    },
    selectedPkgName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 2
    },
    selectedPkgBenefitsCount: {
        fontSize: 12,
        color: '#64748B'
    },
    addonsListHeaderTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0F172A',
    },
    addonsListHeaderSub: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2
    },
    addonSummaryFooter: {
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 14,
        paddingBottom: Platform.OS === 'ios' ? 24 : 14,
        backgroundColor: '#FFFFFF'
    },
    summaryStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    summaryBenefitsLabel: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '700',
        letterSpacing: 0.6,
        marginBottom: 2
    },
    summaryBenefitsCount: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0F172A'
    },
    summaryPriceLabel: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '700',
        letterSpacing: 0.6,
        marginBottom: 2
    },
    summaryPriceValue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#FF5B0A',
    },
    proceedCheckoutBtn: {
        backgroundColor: '#FF5B0A',
        borderRadius: 14,
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    proceedCheckoutBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    }
});
