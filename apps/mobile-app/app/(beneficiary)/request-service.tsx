import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AddressPicker, SelectedAddress } from '../../components/ui/AddressPicker';
import { API_URL } from '@/constants/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocationPermission } from '../../hooks/useLocationPermission';
import { useSafeBack } from '@/hooks/useSafeBack';

export default function RequestServiceScreen() {
  const { width } = useWindowDimensions();
  const MAX_CONTENT_WIDTH = 440;
  const responsiveStyle = { width: '100%' as const, maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' as const };

  const safeBack = useSafeBack();
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<{ id?: string, address: string, lat: number, lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);

  // Request location permission immediately on screen load
  useLocationPermission({ requestOnMount: true });

  React.useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        setSavedAddresses([]);
        return;
      }
      const res = await fetch(`${API_URL}/subscriber/addresses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.addresses) {
        setSavedAddresses(data.addresses);
      }
    } catch (err) {
      console.log('Failed to fetch addresses', err);
    }
  };

  const handleAddressSelected = (addr: SelectedAddress) => {
    setShowLocationPicker(false);
    setSelectedAddress({
      address: addr.address,
      lat: addr.latitude,
      lng: addr.longitude,
    });
  };

  const handleConfirmRequest = async () => {
    if (!selectedAddress) {
      Alert.alert('Error', 'Please select an address first.');
      return;
    }

    setLoading(true);
    try {
      let addressIdToUse = selectedAddress.id;
      const token = await AsyncStorage.getItem('userToken');
      const userStr = await AsyncStorage.getItem('user');
      
      // UI Demo Fallback
      if (!token || !userStr) {
        setTimeout(() => {
          setLoading(false);
          Alert.alert('Success (Demo Mode)', 'Your care service request has been submitted.', [
            { text: 'OK', onPress: () => safeBack() }
          ]);
        }, 1000);
        return;
      }

      const user = JSON.parse(userStr);
      const beneficiaryId = user.id;

      // 1. Create Address in DB if it's new
      if (!addressIdToUse) {
        const addressRes = await fetch(`${API_URL}/subscriber/addresses`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            addressLine: selectedAddress.address,
            city: 'Unknown',
            state: 'Unknown',
            pincode: '000000',
            latitude: selectedAddress.lat,
            longitude: selectedAddress.lng,
            label: 'Service Address'
          })
        });
        const addressData = await addressRes.json();
        if (!addressData.success) throw new Error(addressData.message || 'Failed to save address');
        addressIdToUse = addressData.address.id;
      }

      // 2. Create Service Request (Appointment)
      const reqRes = await fetch(`${API_URL}/subscriber/service-requests`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          beneficiaryId: beneficiaryId,
          addressId: addressIdToUse,
          scheduledDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          notes: 'Care service requested via mobile app',
        })
      });
      const reqData = await reqRes.json();
      
      if (reqData.success) {
        Alert.alert('Success', 'Your care service request has been submitted.', [
          { text: 'OK', onPress: () => safeBack() }
        ]);
      } else {
        throw new Error(reqData.message || 'Failed to submit request');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, responsiveStyle]}>
        <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Service</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={[styles.content, responsiveStyle]}>
        <Text style={styles.sectionTitle}>Where do you need care?</Text>
        
        {savedAddresses.map((addr) => (
          <TouchableOpacity 
            key={addr.id}
            style={[styles.addressCard, selectedAddress?.id === addr.id && styles.selectedAddressCard]}
            onPress={() => setSelectedAddress({
              id: addr.id,
              address: addr.addressLine,
              lat: addr.latitude || 0,
              lng: addr.longitude || 0,
            })}
          >
            <View style={styles.addressIcon}>
              <Feather name="map-pin" size={24} color={selectedAddress?.id === addr.id ? "#FFF" : "#FF6A00"} />
            </View>
            <View style={styles.addressInfo}>
              <Text style={[styles.addressText, selectedAddress?.id === addr.id && { color: '#FFF' }]}>{addr.addressLine}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {selectedAddress && !selectedAddress.id ? (
          <View style={[styles.addressCard, styles.selectedAddressCard]}>
            <View style={styles.addressIcon}>
              <Feather name="map-pin" size={24} color="#FFF" />
            </View>
            <View style={styles.addressInfo}>
              <Text style={[styles.addressText, { color: '#FFF' }]}>{selectedAddress.address}</Text>
              <Text style={{color: '#FFF', fontSize: 12, marginTop: 4}}>New Address (will be saved)</Text>
            </View>
            <TouchableOpacity onPress={() => setShowLocationPicker(true)} style={styles.changeBtn}>
              <Text style={[styles.changeBtnText, { color: '#FFF' }]}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.addAddressBtn} 
            onPress={() => setShowLocationPicker(true)}
          >
            <Feather name="plus-circle" size={24} color="#FF6A00" />
            <Text style={styles.addAddressText}>Select New Location on Map</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      <View style={[styles.footer, responsiveStyle]}>
        <TouchableOpacity 
          style={[styles.submitBtn, (!selectedAddress || loading) && styles.disabledBtn]} 
          onPress={handleConfirmRequest}
          disabled={!selectedAddress || loading}
        >
          <Text style={styles.submitBtnText}>{loading ? 'Submitting...' : 'Confirm Request'}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showLocationPicker} animationType="slide">
        <AddressPicker
          onAddressSelected={handleAddressSelected}
          onCancel={() => setShowLocationPicker(false)}
          title="Select Care Location"
          subtitle="Pin the address where care is needed"
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: '#0F172A',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Outfit-SemiBold',
    color: '#0F172A',
    marginBottom: 16,
  },
  addAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFE5D9',
    borderStyle: 'dashed',
  },
  addAddressText: {
    marginLeft: 12,
    fontSize: 16,
    fontFamily: 'Outfit-Medium',
    color: '#FF6A00',
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  selectedAddressCard: {
    backgroundColor: '#FF6A00',
    borderColor: '#FF6A00',
  },
  addressIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  addressInfo: {
    flex: 1,
  },
  addressText: {
    fontSize: 15,
    fontFamily: 'Outfit-Medium',
    color: '#334155',
    lineHeight: 22,
  },
  changeBtn: {
    padding: 8,
  },
  changeBtnText: {
    color: '#FF6A00',
    fontFamily: 'Outfit-SemiBold',
  },
  footer: {
    padding: 20,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  submitBtn: {
    backgroundColor: '#FF6A00',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Outfit-SemiBold',
  },
  disabledBtn: {
    backgroundColor: '#FDBA74',
  }
});
