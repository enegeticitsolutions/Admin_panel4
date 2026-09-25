import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { customList } from 'country-codes-list';

interface Country {
    code: string;
    name: string;
    callingCode: string;
    flag: string;
}

interface CountryPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (callingCode: string) => void;
    selectedCode: string;
}

export const CountryPickerModal: React.FC<CountryPickerModalProps> = ({
    visible,
    onClose,
    onSelect,
    selectedCode,
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    const countries: Country[] = useMemo(() => {
        const list = customList('countryCode', '{countryNameEn}|{countryCallingCode}|{flag}');
        return Object.keys(list).map(key => {
            const [name, callingCode, flag] = list[key].split('|');
            return {
                code: key,
                name,
                callingCode,
                flag
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, []);

    const filteredCountries = useMemo(() => {
        if (!searchQuery) return countries;
        const q = searchQuery.toLowerCase();
        return countries.filter(c => 
            c.name.toLowerCase().includes(q) || 
            c.callingCode.includes(q) ||
            c.code.toLowerCase().includes(q)
        );
    }, [searchQuery, countries]);

    const renderItem = ({ item }: { item: Country }) => {
        const isSelected = item.callingCode === selectedCode;
        return (
            <TouchableOpacity 
                style={[styles.item, isSelected && styles.itemSelected]}
                onPress={() => {
                    onSelect(item.callingCode);
                    onClose();
                    setSearchQuery('');
                }}
            >
                <View style={styles.itemLeft}>
                    <Text style={styles.flag}>{item.flag}</Text>
                    <Text style={[styles.name, isSelected && styles.nameSelected]}>
                        {item.name}
                    </Text>
                </View>
                <Text style={[styles.callingCode, isSelected && styles.callingCodeSelected]}>
                    +{item.callingCode}
                </Text>
                {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color="#FE6700" style={styles.checkIcon} />
                )}
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.overlayDismiss} activeOpacity={1} onPress={onClose} />
                <View style={styles.sheet}>
                    <View style={styles.handle} />
                    
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <View style={styles.headerIcon}>
                                <Ionicons name="globe-outline" size={20} color="#FE6700" />
                            </View>
                            <Text style={styles.title}>Select Country Code</Text>
                        </View>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <Ionicons name="close" size={20} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search country or code..."
                            placeholderTextColor="#9CA3AF"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoCorrect={false}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.divider} />

                    <FlatList
                        data={filteredCountries}
                        keyExtractor={item => item.code}
                        renderItem={renderItem}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.listContainer}
                        keyboardShouldPersistTaps="handled"
                    />
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "flex-end",
    },
    overlayDismiss: {
        ...StyleSheet.absoluteFillObject,
    },
    sheet: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 12,
        height: "85%", // make it tall enough for country list
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#E5E7EB",
        alignSelf: "center",
        marginBottom: 16,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    headerIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: "#FFF0E6",
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        fontSize: 16,
        fontFamily: "Poppins-SemiBold",
        color: "#111827",
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: "#F3F4F6",
        alignItems: "center",
        justifyContent: "center",
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F9FAFB",
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 12,
        marginHorizontal: 20,
        paddingHorizontal: 14,
        height: 44,
        marginBottom: 16,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        height: 44,
        fontSize: 14,
        fontFamily: "Poppins-Regular",
        color: "#111827",
    },
    divider: {
        height: 1,
        backgroundColor: "#F3F4F6",
    },
    listContainer: {
        paddingBottom: 40,
    },
    item: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#F9FAFB",
    },
    itemSelected: {
        backgroundColor: "#FFF5EE",
    },
    itemLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        marginRight: 10,
    },
    flag: {
        fontSize: 24,
        marginRight: 12,
    },
    name: {
        fontSize: 14,
        fontFamily: "Poppins-Regular",
        color: "#374151",
        flexShrink: 1,
    },
    nameSelected: {
        fontFamily: "Poppins-Medium",
        color: "#FE6700",
    },
    callingCode: {
        fontSize: 14,
        fontFamily: "Poppins-Medium",
        color: "#6B7280",
    },
    callingCodeSelected: {
        color: "#FE6700",
        marginRight: 8,
    },
    checkIcon: {
        marginLeft: 4,
    }
});
