import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import { generateInvoicePDF } from '@/components/invoice/InvoiceGenerator';
import type { InvoiceData } from '@/components/invoice/InvoiceGenerator';

export default function OrderHistoryScreen() {
  const router = useRouter();
  const { pop } = useNavigationStack();
  useAndroidBackHandler();
  
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const resRaw = await fetch(`${API_URL}/subscriber/invoices`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const res = await resRaw.json();
      if (res.success) {
        setInvoices(res.data);
      }
    } catch (e) {
      console.error('Fetch invoices error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (invoiceId: string) => {
    try {
      setDownloadingId(invoiceId);
      const token = await AsyncStorage.getItem('userToken');
      
      const configResRaw = await fetch(`${API_URL}/public/company/config`);
      const configRes = await configResRaw.json();
      const cConfig = configRes.data || {};

      const invoiceResRaw = await fetch(`${API_URL}/subscriber/invoices/${invoiceId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const invoiceRes = await invoiceResRaw.json();
      const invoice = invoiceRes.data;

      if (!invoice) {
        Alert.alert('Not Found', 'Invoice not found.');
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
        cgstAmount: invoice.cgstAmount,
        sgstAmount: invoice.sgstAmount,
        igstAmount: invoice.igstAmount,
        taxAmount: invoice.taxAmount,
        totalAmount: invoice.totalAmount,
        paymentMethod: invoice.payments?.[0]?.paymentMethod || 'Online',
        transactionId: invoice.payments?.[0]?.transactionId || invoice.payments?.[0]?.gatewayPaymentId,
        paymentStatus: invoice.payments?.[0]?.paymentStatus,
        gatewayName: invoice.payments?.[0]?.gatewayName,
      };

      await generateInvoicePDF(invoiceData);
    } catch (error) {
      console.error('Invoice Download Error:', error);
      Alert.alert('Error', 'Could not download invoice. Please try again later.');
    } finally {
      setDownloadingId(null);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isDownloading = downloadingId === item.id;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.invoiceNumber}>{item.invoiceNumber}</Text>
          <Text style={styles.invoiceDate}>{new Date(item.issuedAt).toLocaleDateString('en-IN')}</Text>
        </View>
        
        <View style={styles.cardBody}>
          <Text style={styles.packageText}>
            {item.invoiceType === 'SERVICE' 
              ? (item.items?.[0]?.description || 'Service Invoice')
              : (item.subscription?.package?.name || 'Subscription Package')}
          </Text>
          <Text style={styles.amountText}>₹{item.totalAmount.toFixed(2)}</Text>
        </View>
        
        <View style={styles.cardFooter}>
          <View style={[styles.statusBadge, { backgroundColor: item.status === 'PAID' ? '#D5FBDD' : '#FFE2CB' }]}>
            <Text style={[styles.statusText, { color: item.status === 'PAID' ? '#00A651' : '#FE6700' }]}>
              {item.status}
            </Text>
          </View>

          <TouchableOpacity style={styles.downloadBtn} onPress={() => handleDownload(item.id)} disabled={isDownloading}>
            {isDownloading ? (
              <ActivityIndicator size="small" color="#FE6700" style={{ marginRight: 6 }} />
            ) : (
              <Ionicons name="download-outline" size={16} color="#050505" style={{ marginRight: 6 }} />
            )}
            <Text style={styles.downloadText}>{isDownloading ? 'Downloading...' : 'Download Invoice'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FE6700" />
      </View>
    );
  }

  if (invoices.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.inlineHeader}>
          <TouchableOpacity onPress={() => pop()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Summary</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
          <Text style={styles.emptyText}>No order history found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.inlineHeader}>
        <TouchableOpacity onPress={() => pop()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Summary</Text>
      </View>
      <View style={styles.container}>
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF2E8',
  },
  inlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF2E8',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 6,
  },
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    paddingHorizontal: 15,
  },
  centerContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 20
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  invoiceNumber: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  invoiceDate: {
    fontSize: 13,
    color: '#6B7280',
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  packageText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
    flex: 1,
    marginRight: 12,
  },
  amountText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#050505',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  downloadText: {
    fontSize: 14,
    color: '#050505',
    fontWeight: '500',
  },
});
