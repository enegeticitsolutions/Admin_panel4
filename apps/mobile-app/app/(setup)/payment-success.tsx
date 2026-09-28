import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CallbackButton } from '../../components/CallbackButton';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Alert } from 'react-native';
import { API_URL } from '@/constants/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateInvoicePDF } from '../../components/invoice/InvoiceGenerator';
import type { InvoiceData } from '../../components/invoice/InvoiceGenerator';

import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';

export default function PaymentSuccessScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { resetStack } = useNavigationStack();
    const [isDownloading, setIsDownloading] = React.useState(false);

    React.useEffect(() => {
        resetStack();
    }, [resetStack]);

    useAndroidBackHandler('/(subscriber)');

    // Destructure passed data (or use defaults if missing)
    const orderId = (params.orderId as string) || `ORD${Date.now()}`;
    const packageName = (params.packageName as string) || 'Basic Care';
    const price = (params.price as string) || '2999';

    // Format dates
    const today = new Date();
    const purchaseDate = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const activationDate = tomorrow.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    // Parse real package benefits passed from checkout screen
    const packageIncludes: string[] = React.useMemo(() => {
        const benefitsParam = params.benefits as string;
        if (benefitsParam) {
            try {
                const parsed = JSON.parse(benefitsParam);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            } catch (e) {
                // fall through to defaults
            }
        }
        // Fallback defaults if no benefits param was passed
        if (packageName.toLowerCase().includes('platinum') || packageName.toLowerCase().includes('elite')) {
            return ['5 visits per week', 'Daily Vital monitoring', 'Medication reminders', '24/7 Priority Support', 'Doctor Consults'];
        }
        if (packageName.toLowerCase().includes('gold') || packageName.toLowerCase().includes('premium')) {
            return ['3 visits per week', 'Vital monitoring', 'Medication reminders', 'Emergency contact support'];
        }
        return ['1 visit per week', 'Vital monitoring', 'Medication reminders', 'Standard support'];
    }, [params.benefits, packageName]);

    const durationLabel = (params.durationLabel as string) || '1 Month';

    const handleDownloadInvoice = async () => {
        try {
            setIsDownloading(true);
            const token = await AsyncStorage.getItem('userToken');
            
            // 1. Fetch Company Config
            const configResRaw = await fetch(`${API_URL}/public/company/config`);
            const configRes = await configResRaw.json();
            const cConfig = configRes.data || {};

            // 2. Fetch Invoice By OrderId
            // The Razorpay order ID is what we saved in the backend as transactionId during creation
            const invoiceResRaw = await fetch(`${API_URL}/subscriber/invoices/order/${orderId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const invoiceRes = await invoiceResRaw.json();
            const invoice = invoiceRes.data;

            if (!invoice) {
                Alert.alert('Not Found', 'Invoice not found for this order.');
                return;
            }

            const invoiceData: InvoiceData = {
                invoiceNumber: invoice.invoiceNumber,
                issuedAt: invoice.issuedAt,
                status: invoice.status,
                companyName: cConfig.COMPANY_NAME,
                companyAddress: cConfig.COMPANY_ADDRESS,
                companyGstin: cConfig.COMPANY_GSTIN,
                companyPan: cConfig.COMPANY_PAN,
                companyCin: cConfig.COMPANY_CIN,
                companyEmail: cConfig.COMPANY_EMAIL,
                companyPhone: cConfig.COMPANY_PHONE,
                companyBankName: cConfig.COMPANY_BANK_NAME,
                companyBankAccount: cConfig.COMPANY_BANK_ACCOUNT,
                companyBankIfsc: cConfig.COMPANY_BANK_IFSC,
                companyUpiId: cConfig.COMPANY_UPI_ID,
                subscriberName: invoice.subscriber?.name || 'Subscriber',
                subscriberPhone: invoice.subscriber?.phone || '',
                subscriberEmail: invoice.subscriber?.email || '',
                subscriberAddress: invoice.subscriber?.address || 'Haryana',
                placeOfSupply: invoice.placeOfSupply || 'Haryana',
                items: invoice.items.map((i: any) => ({
                    description: i.description,
                    hsnSacCode: i.hsnSacCode,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                    taxRate: i.taxRate,
                    tax: i.isGstExempt ? 0 : Math.round(((i.amount * (i.taxRate || 0)) / 100) * 100) / 100,
                    amount: i.amount
                })),
                baseAmount: invoice.baseAmount,
                discountAmount: invoice.discountAmount,
                saathiDiscountAmount: invoice.saathiDiscountAmount,
                cgstAmount: invoice.cgstAmount,
                sgstAmount: invoice.sgstAmount,
                igstAmount: invoice.igstAmount,
                taxAmount: invoice.taxAmount,
                totalAmount: invoice.totalAmount,
            };

            await generateInvoicePDF(invoiceData);
        } catch (error) {
            console.error('Invoice Download Error:', error);
            Alert.alert('Error', 'Could not download invoice. Please try again later.');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Top Success Area */}
                <View style={styles.successArea}>
                    <View style={styles.checkmarkCircle}>
                        <Ionicons name="checkmark-circle-outline" size={48} color="#00A651" />
                    </View>
                    <Text style={styles.successTitle}>Payment Successful!</Text>
                    <Text style={styles.successSubtitle}>
                        Thank you for subscribing to our{'\n'}care services
                    </Text>
                </View>

                {/* Order Details Ribbon */}
                <View style={styles.orderRibbon}>
                    <Ionicons name="cube-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.ribbonTitle}>Order Details</Text>
                        <Text style={styles.ribbonId}>Order ID: {orderId}</Text>
                    </View>
                </View>

                {/* Invoice Card */}
                <View style={styles.invoiceCard}>
                    <View style={styles.invoiceHeader}>
                        <View>
                            <Text style={styles.packageName}>{packageName}</Text>
                            <Text style={styles.packageDuration}>{durationLabel}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.packagePrice}>₹{price}</Text>
                            <Text style={styles.perMonth}>{durationLabel === '1 Year' ? '/year' : durationLabel === '6 Months' ? '/6 months' : durationLabel === '3 Months' ? '/3 months' : '/month'}</Text>
                        </View>
                    </View>

                    {/* Includes box */}
                    <View style={styles.includesBox}>
                        <Text style={styles.includesTitle}>Package Includes:</Text>
                        {packageIncludes.map((item, index) => (
                            <View key={index} style={styles.bulletRow}>
                                <Ionicons name="checkmark-circle" size={18} color="#FE6700" style={{ marginRight: 12 }} />
                                <Text style={styles.bulletText}>{item}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.separator} />

                    {/* Dates & Payment */}
                    <View style={styles.detailRow}>
                        <View style={styles.iconBoxBlue}>
                            <Ionicons name="calendar-outline" size={21} color="#FE6700" />
                        </View>
                        <View>
                            <Text style={styles.detailLabel}>Purchase Date</Text>
                            <Text style={styles.detailValue}>{purchaseDate}</Text>
                        </View>
                    </View>

                    <View style={styles.detailRow}>
                        <View style={styles.iconBoxGreen}>
                            <Ionicons name="calendar" size={21} color="#FE6700" />
                        </View>
                        <View>
                            <Text style={styles.detailLabel}>Service Activation</Text>
                            <Text style={styles.detailValue}>{activationDate}</Text>
                        </View>
                    </View>

                    <View style={styles.detailRow}>
                        <View style={styles.iconBoxPurple}>
                            <Ionicons name="card-outline" size={21} color="#FE6700" />
                        </View>
                        <View>
                            <Text style={styles.detailLabel}>Payment Method</Text>
                            <Text style={styles.detailValue}>Digital Payment</Text>
                            <Text style={styles.detailSub}>**** **** **** 3456</Text>
                        </View>
                    </View>
                </View>

                {/* What's Next Card */}
                <View style={styles.whatsNextCard}>
                    <Text style={styles.whatsNextTitle}>{"What's Next?"}</Text>
                    <Text style={styles.whatsNextSub}>Follow these steps to get started</Text>

                    {/* Steps */}
                    <View style={styles.stepRow}>
                        <View style={styles.stepNumberCircle}><Text style={styles.stepNumber}>1</Text></View>
                        <View style={styles.stepContent}>
                            <Text style={styles.stepTitle}>Check Your Email</Text>
                            <Text style={styles.stepDesc}>{"We've sent a confirmation email with your subscription details and invoice"}</Text>
                        </View>
                    </View>

                    <View style={styles.stepRow}>
                        <View style={styles.stepNumberCircle}><Text style={styles.stepNumber}>2</Text></View>
                        <View style={styles.stepContent}>
                            <Text style={styles.stepTitle}>Enroll Your Beneficiary</Text>
                            <Text style={styles.stepDesc}>Add details of the senior citizen who will receive care services</Text>
                        </View>
                    </View>

                    <View style={styles.stepRow}>
                        <View style={styles.stepNumberCircle}><Text style={styles.stepNumber}>3</Text></View>
                        <View style={styles.stepContent}>
                            <Text style={styles.stepTitle}>Meet Your Care Companion</Text>
                            <Text style={styles.stepDesc}>Our team will assign a dedicated care companion within 24 hours</Text>
                        </View>
                    </View>
                </View>

                {/* Actions */}
                <TouchableOpacity style={styles.enrollBtn} onPress={() => router.replace('/(subscriber)')}>
                    <Ionicons name="home-outline" size={19} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.enrollBtnText}>Go to Dashboard</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.addBeneficiaryBtn} 
                    onPress={() => router.replace({
                        pathname: '/(setup)/beneficiary-info',
                        params: { isLinkingFlow: 'true' }
                    })}
                >
                    <Ionicons name="person-add-outline" size={19} color="#FE6700" style={{ marginRight: 8 }} />
                    <Text style={styles.addBeneficiaryBtnText}>Add Beneficiary to this Package</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.linkBtn} onPress={handleDownloadInvoice} disabled={isDownloading}>
                    {isDownloading ? (
                        <ActivityIndicator size="small" color="#FE6700" style={{ marginRight: 8 }} />
                    ) : (
                        <Ionicons name="download-outline" size={24} color="#050505" style={{ marginRight: 8 }} />
                    )}
                    <Text 
                        style={styles.linkBtnText}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                    >
                        {isDownloading ? 'Downloading...' : 'Download Invoice'}
                    </Text>
                </TouchableOpacity>

                {/*<TouchableOpacity style={styles.linkBtn}>
                        <Ionicons name="chatbubble-outline" size={14} color="#4B5563" style={{ marginRight: 6 }} />
                        <Text style={styles.linkBtnText}>Contact Support</Text>
                    </TouchableOpacity>*/}

                {/* Support Card */}
                <View style={styles.supportCard}>
                    <View style={styles.supportHeader}>
                        <Image
                            source={require('../../assets/images/assistance.png')}
                            style={styles.supportImage}
                            resizeMode="contain"
                        />
                        <View style={styles.supportTextContainer}>
                            <Text style={styles.supportTitle}>Need assistance?</Text>
                            <Text style={styles.supportDesc}>
                                Our experts are here to help you choose the right plan via Phone or WhatsApp.
                            </Text>
                        </View>
                    </View>
                    <View style={styles.supportButtonsRow}>
                        <CallbackButton
                            style={styles.callbackBtn}
                            textStyle={styles.callbackBtnText}
                            label="Request Callback"
                            notes="Requested from payment success screen"
                        />
                        <TouchableOpacity style={styles.chatBtn}>
                            <Ionicons name="chatbubbles" size={34} color="#FE6700" />
                        </TouchableOpacity>
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FDEFE5' },
    scrollContent: { paddingHorizontal: 18, paddingTop: 36, paddingBottom: 32, maxWidth: 430, width: '100%', alignSelf: 'center' },

    successArea: { alignItems: 'center', marginBottom: 34 },
    checkmarkCircle: {
        width: 60, height: 60, borderRadius: 30, backgroundColor: '#D5FBDD',
        alignItems: 'center', justifyContent: 'center', marginBottom: 16
    },
    successTitle: { fontSize: 18, fontWeight: '500', color: '#050505', marginBottom: 6 },
    successSubtitle: { fontSize: 11, color: '#111111', textAlign: 'center', lineHeight: 16, fontWeight: '400' },

    orderRibbon: {
        backgroundColor: '#FE6700', paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center',
        borderTopLeftRadius: 6, borderTopRightRadius: 6
    },
    ribbonTitle: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
    ribbonId: { color: '#FFFFFF', fontSize: 10, fontWeight: '400', marginTop: 1 },

    invoiceCard: {
        backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 20,
        borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
        shadowColor: '#7A4A28', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 22, elevation: 5,
        marginBottom: 24
    },
    invoiceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
    packageName: { fontSize: 12, fontWeight: '400', color: '#050505' },
    packageDuration: { fontSize: 10, color: '#3B3B3B', marginTop: 0 },
    packagePrice: { fontSize: 15, fontWeight: '700', color: '#FE6700' },
    perMonth: { fontSize: 10, color: '#3B3B3B', marginTop: 0, textAlign: 'right' },

    includesBox: { backgroundColor: '#F7F7F7', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 14, marginBottom: 12 },
    includesTitle: { fontSize: 10, fontWeight: '400', color: '#3A3A3A', marginBottom: 10 },
    bulletRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    bulletText: { fontSize: 10, color: '#181818', fontWeight: '400' },

    separator: { height: 1, backgroundColor: '#E5E2DE', marginBottom: 14 },

    detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    iconBoxBlue: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#FFE2CB', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    iconBoxGreen: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#FFE2CB', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    iconBoxPurple: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#FFE2CB', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    detailLabel: { fontSize: 10, color: '#3B3B3B', marginBottom: 1, fontWeight: '400' },
    detailValue: { fontSize: 10, fontWeight: '400', color: '#050505' },
    detailSub: { fontSize: 10, color: '#3B3B3B', marginTop: 2 },

    whatsNextCard: {
        backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, borderRadius: 16,
        shadowColor: '#7A4A28', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.14, shadowRadius: 20, elevation: 4,
        marginBottom: 24
    },
    whatsNextTitle: { fontSize: 10, fontWeight: '400', color: '#050505', marginBottom: 4 },
    whatsNextSub: { fontSize: 10, color: '#3B3B3B', marginBottom: 18 },

    stepRow: { flexDirection: 'row', marginBottom: 14 },
    stepNumberCircle: {
        width: 24, height: 24, borderRadius: 12, backgroundColor: '#FE6700',
        alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 1
    },
    stepNumber: { color: '#FFFFFF', fontSize: 10, fontWeight: '500' },
    stepContent: { flex: 1 },
    stepTitle: { fontSize: 10, fontWeight: '400', color: '#050505', marginBottom: 4 },
    stepDesc: { fontSize: 10, color: '#3B3B3B', lineHeight: 14 },

    enrollBtn: {
        backgroundColor: '#FE6700', height: 38, borderRadius: 7,
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12
    },
    enrollBtnText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', marginRight: 8 },

    addBeneficiaryBtn: {
        backgroundColor: '#FFFFFF', height: 38, borderRadius: 7,
        borderWidth: 2, borderColor: '#FE6700',
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12
    },
    addBeneficiaryBtnText: { color: '#FE6700', fontSize: 10, fontWeight: '700' },

    beneficiaryBtn: {
        backgroundColor: '#FFFFFF', height: 38, borderRadius: 7,
        borderWidth: 2, borderColor: '#FE6700',
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12
    },
    beneficiaryBtnText: { color: '#FE6700', fontSize: 10, fontWeight: '700' },

    outlineBtn: {
        borderWidth: 1, borderColor: '#FE6700', height: 38, borderRadius: 7,
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16,
        backgroundColor: '#FFFFFF'
    },
    outlineBtnText: { color: '#FE6700', fontSize: 10, fontWeight: '600' },

    linkBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, marginBottom: 16 },
    linkBtnText: { color: '#050505', fontSize: 15, fontWeight: '500' },

    supportCard: {
        backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18, borderRadius: 16,
        shadowColor: '#7A4A28', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 4
    },
    supportHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    supportImage: { width: 60, height: 60, marginRight: 10 },
    supportTextContainer: { flex: 1 },
    supportTitle: { fontSize: 14, fontWeight: '700', color: '#111111', marginBottom: 8 },
    supportDesc: { fontSize: 11, color: '#111111', lineHeight: 16, fontWeight: '400' },
    supportButtonsRow: { flexDirection: 'row', alignItems: 'center' },
    callbackBtn: {
        flex: 1, borderWidth: 1, borderColor: '#FE6700', height: 38, borderRadius: 9,
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginRight: 10,
        backgroundColor: '#FFFFFF'
    },
    callbackBtnText: { color: '#FE6700', fontSize: 10, fontWeight: '700' },
    chatBtn: {
        width: 38, height: 38, borderRadius: 9, backgroundColor: '#FFFFFF',
        alignItems: 'center', justifyContent: 'center'
    }
});
