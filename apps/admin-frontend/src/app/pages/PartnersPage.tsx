import React, { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { StatusChip } from '../components/common/StatusChip';
import { partnerApi } from '../../services/api';
import type { Partner, PartnerCategory, PartnerStatus, PartnerDocument } from '../../types';
import {
  Building2,
  Phone,
  Mail,
  User,
  MapPin,
  Globe,
  Plus,
  Edit2,
  Trash2,
  Eye,
  RefreshCw,
  Layers,
  Search,
  CheckCircle2,
  Clock,
  ExternalLink,
  Tag,
  FileText,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Database,
  X,
  Check,
  AlertCircle,
  Image as ImageIcon,
  Upload,
  Star,
  Loader2,
  Paperclip,
  File,
  Download,
  FolderOpen,
} from 'lucide-react';

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [categories, setCategories] = useState<PartnerCategory[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inReview: 0,
    approved: 0,
    published: 0,
    zohoSynced: 0,
    totalCategories: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPublish, setSelectedPublish] = useState<string>('ALL');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [zohoPayloadViewerPartner, setZohoPayloadViewerPartner] = useState<Partner | null>(null);

  // Form States for Partner Create/Edit
  const [partnerFormData, setPartnerFormData] = useState<Partial<Partner>>({
    organizationName: '',
    categoryId: '',
    description: '',
    primaryContactName: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    attachmentUrl: '',
    status: 'PENDING',
    adminNotes: '',
    isPublished: false,
    isFeatured: false,
    displayOrder: 0,
    logoUrl: '',
    bannerImageUrl: '',
    photos: [],
    websiteUrl: '',
    customBadgeText: '',
    serviceHighlights: [],
  });

  // Category Form State
  const [categoryFormData, setCategoryFormData] = useState<Partial<PartnerCategory>>({
    name: '',
    slug: '',
    code: '',
    description: '',
    iconUrl: '',
    displayOrder: 0,
    isActive: true,
  });
  const [editingCategory, setEditingCategory] = useState<PartnerCategory | null>(null);
  const [highlightsInput, setHighlightsInput] = useState<string>('');

  // Single-Add Photo Management States
  const [currentPhotoInput, setCurrentPhotoInput] = useState<string>('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);

  // Single-Add Document Management States
  const [selectedDocType, setSelectedDocType] = useState<string>('MOU / Agreement');
  const [customDocNameInput, setCustomDocNameInput] = useState<string>('');
  const [customDocUrlInput, setCustomDocUrlInput] = useState<string>('');
  const [isUploadingDocument, setIsUploadingDocument] = useState<boolean>(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [partnersData, categoriesData, statsData] = await Promise.all([
        partnerApi.getAll(),
        partnerApi.getCategories(),
        partnerApi.getStats().catch(() => ({
          total: 0,
          pending: 0,
          inReview: 0,
          approved: 0,
          published: 0,
          zohoSynced: 0,
          totalCategories: 0,
        })),
      ]);

      setPartners(partnersData || []);
      setCategories(categoriesData || []);
      setStats(statsData);
    } catch (err: any) {
      console.error('Failed to load partners data:', err);
      setError(err.message || 'Failed to load partners.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
  };

  // Photo Management Handlers
  const handleAddPhotoUrl = () => {
    if (!currentPhotoInput.trim()) return;
    const newPhoto = currentPhotoInput.trim();
    const existingPhotos = partnerFormData.photos || [];
    if (existingPhotos.includes(newPhoto)) {
      alert('This photo has already been added to the list.');
      return;
    }
    const updatedPhotos = [...existingPhotos, newPhoto];
    setPartnerFormData({
      ...partnerFormData,
      photos: updatedPhotos,
      bannerImageUrl: partnerFormData.bannerImageUrl || newPhoto,
    });
    setCurrentPhotoInput('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setIsUploadingPhoto(true);
    try {
      let photoUrl = '';
      try {
        const res = await partnerApi.uploadPhoto(file);
        photoUrl = res?.previewUrl || res?.url || (res as any)?.data?.url || '';
      } catch (uploadErr) {
        console.warn('Backend storage upload error, falling back to local reader:', uploadErr);
      }

      // Fallback to local Data URL if backend storage returns empty or has issue
      if (!photoUrl) {
        photoUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      if (photoUrl) {
        const existingPhotos = partnerFormData.photos || [];
        const updatedPhotos = [...existingPhotos, photoUrl];
        setPartnerFormData({
          ...partnerFormData,
          photos: updatedPhotos,
          bannerImageUrl: partnerFormData.bannerImageUrl || photoUrl,
        });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to process photo');
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (photoToRemove: string) => {
    const existingPhotos = partnerFormData.photos || [];
    const updatedPhotos = existingPhotos.filter((p) => p !== photoToRemove);
    let updatedBanner = partnerFormData.bannerImageUrl;
    if (updatedBanner === photoToRemove) {
      updatedBanner = updatedPhotos.length > 0 ? updatedPhotos[0] : '';
    }
    setPartnerFormData({
      ...partnerFormData,
      photos: updatedPhotos,
      bannerImageUrl: updatedBanner,
    });
  };

  const handleSetCoverPhoto = (photoUrl: string) => {
    setPartnerFormData({
      ...partnerFormData,
      bannerImageUrl: photoUrl,
    });
  };

  // Document Management Handlers
  const handleDocumentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setIsUploadingDocument(true);
    try {
      let docData: PartnerDocument | null = null;
      try {
        const res = await partnerApi.uploadDocument(file);
        if (res && (res.url || res.previewUrl)) {
          docData = {
            name: customDocNameInput.trim() || res.name || file.name,
            url: res.previewUrl || res.url,
            documentType: selectedDocType,
            fileSizeBytes: res.fileSizeBytes || file.size,
            uploadedAt: res.uploadedAt || new Date().toISOString(),
          };
        }
      } catch (uploadErr) {
        console.warn('Backend document upload fallback to client file reader:', uploadErr);
      }

      if (!docData) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        docData = {
          name: customDocNameInput.trim() || file.name,
          url: dataUrl,
          documentType: selectedDocType,
          fileSizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
        };
      }

      const existingDocs = partnerFormData.documents || [];
      const updatedDocs = [...existingDocs, docData];
      setPartnerFormData({
        ...partnerFormData,
        documents: updatedDocs,
        attachmentUrl: partnerFormData.attachmentUrl || docData.url,
      });
      setCustomDocNameInput('');
    } catch (err: any) {
      alert(err.message || 'Failed to process document');
    } finally {
      setIsUploadingDocument(false);
      e.target.value = '';
    }
  };

  const handleAddDocumentUrl = () => {
    if (!customDocUrlInput.trim()) return;
    const docUrl = customDocUrlInput.trim();
    const docName = customDocNameInput.trim() || `${selectedDocType} Document`;
    const newDoc: PartnerDocument = {
      name: docName,
      url: docUrl,
      documentType: selectedDocType,
      uploadedAt: new Date().toISOString(),
    };
    const existingDocs = partnerFormData.documents || [];
    const updatedDocs = [...existingDocs, newDoc];
    setPartnerFormData({
      ...partnerFormData,
      documents: updatedDocs,
      attachmentUrl: partnerFormData.attachmentUrl || docUrl,
    });
    setCustomDocUrlInput('');
    setCustomDocNameInput('');
  };

  const handleRemoveDocument = (indexToRemove: number) => {
    const existingDocs = partnerFormData.documents || [];
    const updatedDocs = existingDocs.filter((_, idx) => idx !== indexToRemove);
    setPartnerFormData({
      ...partnerFormData,
      documents: updatedDocs,
      attachmentUrl: updatedDocs.length > 0 ? updatedDocs[0].url : '',
    });
  };

  // Open Create Partner Modal
  const handleOpenCreateModal = () => {
    const defaultCatId = categories.length > 0 ? categories[0].id : '';
    setPartnerFormData({
      organizationName: '',
      categoryId: defaultCatId,
      description: '',
      primaryContactName: '',
      email: '',
      phone: '',
      city: '',
      state: '',
      attachmentUrl: '',
      documents: [],
      status: 'PENDING',
      adminNotes: '',
      isPublished: false,
      isFeatured: false,
      displayOrder: 0,
      logoUrl: '',
      bannerImageUrl: '',
      photos: [],
      websiteUrl: '',
      customBadgeText: '',
      serviceHighlights: [],
    });
    setHighlightsInput('');
    setCurrentPhotoInput('');
    setCustomDocNameInput('');
    setCustomDocUrlInput('');
    setIsAddModalOpen(true);
  };

  // Open Edit Partner Modal
  const handleOpenEditModal = (partner: Partner) => {
    setSelectedPartner(partner);
    const existingPhotos = Array.isArray(partner.photos) && partner.photos.length > 0
      ? partner.photos
      : (partner.bannerImageUrl ? [partner.bannerImageUrl] : []);

    const existingDocs: PartnerDocument[] = Array.isArray(partner.documents) && partner.documents.length > 0
      ? partner.documents
      : (partner.attachmentUrl ? [{ name: 'Attached Profile / MOU', url: partner.attachmentUrl, documentType: 'Compliance / MOU' }] : []);

    setPartnerFormData({
      ...partner,
      photos: existingPhotos,
      documents: existingDocs,
      bannerImageUrl: partner.bannerImageUrl || (existingPhotos.length > 0 ? existingPhotos[0] : ''),
      serviceHighlights: partner.serviceHighlights || [],
    });
    setHighlightsInput((partner.serviceHighlights || []).join(', '));
    setCurrentPhotoInput('');
    setCustomDocNameInput('');
    setCustomDocUrlInput('');
    setIsEditModalOpen(true);
  };

  // Save Partner (Create or Update)
  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerFormData.organizationName?.trim() || !partnerFormData.categoryId || !partnerFormData.description?.trim()) {
      alert('Please fill all required fields: Organization Name, Category, and Description.');
      return;
    }

    try {
      const highlightsArray = highlightsInput
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);

      const photosArray = Array.isArray(partnerFormData.photos) ? partnerFormData.photos.filter(Boolean) : [];
      const primaryBanner = partnerFormData.bannerImageUrl || (photosArray.length > 0 ? photosArray[0] : '');
      const docsArray = Array.isArray(partnerFormData.documents) ? partnerFormData.documents : [];

      const payload = {
        ...partnerFormData,
        photos: photosArray,
        documents: docsArray,
        bannerImageUrl: primaryBanner,
        serviceHighlights: highlightsArray,
      };

      if (selectedPartner?.id) {
        await partnerApi.update(selectedPartner.id, payload);
      } else {
        await partnerApi.create(payload);
      }

      setIsAddModalOpen(false);
      setIsEditModalOpen(false);
      setSelectedPartner(null);
      await loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to save partner.');
    }
  };

  // Toggle Live Website Status
  const handleTogglePublish = async (partner: Partner) => {
    try {
      const updated = await partnerApi.togglePublish(partner.id);
      setPartners((prev) =>
        prev.map((p) => (p.id === partner.id ? { ...p, isPublished: updated.isPublished } : p))
      );
      setStats((prev) => ({
        ...prev,
        published: updated.isPublished ? prev.published + 1 : Math.max(0, prev.published - 1),
      }));
    } catch (err: any) {
      alert(err.message || 'Failed to toggle publication status.');
    }
  };

  // Quick Status Change
  const handleStatusChange = async (partnerId: string, newStatus: PartnerStatus) => {
    try {
      await partnerApi.updateStatus(partnerId, newStatus);
      setPartners((prev) =>
        prev.map((p) => (p.id === partnerId ? { ...p, status: newStatus } : p))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to update status.');
    }
  };

  // Delete Partner
  const handleDeletePartner = async (partner: Partner) => {
    if (!window.confirm(`Are you sure you want to delete "${partner.organizationName}"?`)) return;
    try {
      await partnerApi.delete(partner.id);
      setPartners((prev) => prev.filter((p) => p.id !== partner.id));
      setStats((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
    } catch (err: any) {
      alert(err.message || 'Failed to delete partner.');
    }
  };

  // Save Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryFormData.name?.trim()) {
      alert('Category Name is required.');
      return;
    }

    try {
      if (editingCategory) {
        await partnerApi.updateCategory(editingCategory.id, categoryFormData);
      } else {
        await partnerApi.createCategory(categoryFormData);
      }
      setCategoryFormData({
        name: '',
        slug: '',
        code: '',
        description: '',
        iconUrl: '',
        displayOrder: 0,
        isActive: true,
      });
      setEditingCategory(null);
      const updatedCategories = await partnerApi.getCategories();
      setCategories(updatedCategories || []);
    } catch (err: any) {
      alert(err.message || 'Failed to save category.');
    }
  };

  // Delete Category
  const handleDeleteCategory = async (category: PartnerCategory) => {
    if (!window.confirm(`Are you sure you want to delete category "${category.name}"? This will permanently remove it if no partners are attached.`)) {
      return;
    }
    try {
      await partnerApi.deleteCategory(category.id);
      const updatedCategories = await partnerApi.getCategories();
      setCategories(updatedCategories || []);
      if (editingCategory?.id === category.id) {
        setEditingCategory(null);
        setCategoryFormData({
          name: '',
          slug: '',
          code: '',
          description: '',
          iconUrl: '',
          displayOrder: 0,
          isActive: true,
        });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete category.');
    }
  };

  // Toggle Category Active Status
  const handleToggleCategoryActive = async (category: PartnerCategory) => {
    try {
      await partnerApi.updateCategory(category.id, { isActive: !category.isActive });
      const updatedCategories = await partnerApi.getCategories();
      setCategories(updatedCategories || []);
    } catch (err: any) {
      alert(err.message || 'Failed to update category status.');
    }
  };

  // Filtered partners list
  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      const orgName = (p.organizationName || p.name || '').toLowerCase();
      const contact = (p.primaryContactName || p.contactPerson || '').toLowerCase();
      const email = (p.email || '').toLowerCase();
      const phone = (p.phone || '').toLowerCase();
      const city = (p.city || p.address || '').toLowerCase();
      const search = searchTerm.toLowerCase();

      const matchesSearch =
        !search ||
        orgName.includes(search) ||
        contact.includes(search) ||
        email.includes(search) ||
        phone.includes(search) ||
        city.includes(search);

      const matchesCategory =
        selectedCategory === 'ALL' || p.categoryId === selectedCategory || p.category?.id === selectedCategory;

      const matchesStatus = selectedStatus === 'ALL' || p.status === selectedStatus;

      const matchesPublish =
        selectedPublish === 'ALL' ||
        (selectedPublish === 'PUBLISHED' && p.isPublished) ||
        (selectedPublish === 'HIDDEN' && !p.isPublished);

      const matchesSource = selectedSource === 'ALL' || p.source === selectedSource;

      return matchesSearch && matchesCategory && matchesStatus && matchesPublish && matchesSource;
    });
  }, [partners, searchTerm, selectedCategory, selectedStatus, selectedPublish, selectedSource]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Partner & Ecosystem Management"
          description="Manage healthcare providers, Zoho CRM applications, dynamic categories, and website publishing."
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 shadow-sm transition"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              setEditingCategory(null);
              setCategoryFormData({
                name: '',
                slug: '',
                code: '',
                description: '',
                iconUrl: '',
                displayOrder: 0,
                isActive: true,
              });
              setIsCategoryModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition shadow-sm"
          >
            <Layers className="w-4 h-4" />
            Manage Categories ({categories.length})
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#1F8A3E] text-white rounded-lg hover:bg-[#186e32] transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Partner
          </button>
        </div>
      </div>

      {/* Stats Bar (Interactive Filter Buttons) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Partners */}
        <button
          type="button"
          onClick={() => {
            setSelectedCategory('ALL');
            setSelectedStatus('ALL');
            setSelectedPublish('ALL');
            setSelectedSource('ALL');
            setSearchTerm('');
          }}
          className={`text-left p-4 rounded-xl border transition-all duration-150 shadow-sm cursor-pointer hover:shadow-md active:scale-[0.98] ${
            selectedStatus === 'ALL' && selectedPublish === 'ALL' && selectedSource === 'ALL' && selectedCategory === 'ALL' && !searchTerm
              ? 'bg-gray-50 border-gray-400 ring-2 ring-gray-700 shadow-inner'
              : 'bg-white border-gray-200 hover:border-gray-400'
          }`}
          title="Show All Partners"
        >
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Partners</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total || partners.length}</div>
        </button>

        {/* Pending Review */}
        <button
          type="button"
          onClick={() => {
            if (selectedStatus === 'PENDING') {
              setSelectedStatus('ALL');
            } else {
              setSelectedStatus('PENDING');
              setSelectedPublish('ALL');
              setSelectedSource('ALL');
            }
          }}
          className={`text-left p-4 rounded-xl border transition-all duration-150 shadow-sm cursor-pointer hover:shadow-md active:scale-[0.98] ${
            selectedStatus === 'PENDING'
              ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-500 shadow-inner'
              : 'bg-white border-gray-200 hover:border-amber-300 hover:bg-amber-50/30'
          }`}
          title="Filter by Pending Review"
        >
          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Pending Review</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{stats.pending}</div>
        </button>

        {/* Approved */}
        <button
          type="button"
          onClick={() => {
            if (selectedStatus === 'APPROVED') {
              setSelectedStatus('ALL');
            } else {
              setSelectedStatus('APPROVED');
              setSelectedPublish('ALL');
              setSelectedSource('ALL');
            }
          }}
          className={`text-left p-4 rounded-xl border transition-all duration-150 shadow-sm cursor-pointer hover:shadow-md active:scale-[0.98] ${
            selectedStatus === 'APPROVED'
              ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500 shadow-inner'
              : 'bg-white border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30'
          }`}
          title="Filter by Approved"
        >
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Approved</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{stats.approved}</div>
        </button>

        {/* Live on Website */}
        <button
          type="button"
          onClick={() => {
            if (selectedPublish === 'PUBLISHED') {
              setSelectedPublish('ALL');
            } else {
              setSelectedPublish('PUBLISHED');
              setSelectedStatus('ALL');
              setSelectedSource('ALL');
            }
          }}
          className={`text-left p-4 rounded-xl border transition-all duration-150 shadow-sm cursor-pointer hover:shadow-md active:scale-[0.98] ${
            selectedPublish === 'PUBLISHED'
              ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500 shadow-inner'
              : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
          }`}
          title="Filter by Live on Website"
        >
          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Live on Website</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{stats.published}</div>
        </button>

        {/* Zoho CRM Synced */}
        <button
          type="button"
          onClick={() => {
            if (selectedSource === 'ZOHO_CRM') {
              setSelectedSource('ALL');
            } else {
              setSelectedSource('ZOHO_CRM');
              setSelectedStatus('ALL');
              setSelectedPublish('ALL');
            }
          }}
          className={`text-left p-4 rounded-xl border transition-all duration-150 shadow-sm cursor-pointer hover:shadow-md active:scale-[0.98] ${
            selectedSource === 'ZOHO_CRM'
              ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-500 shadow-inner'
              : 'bg-white border-gray-200 hover:border-orange-300 hover:bg-orange-50/30'
          }`}
          title="Filter by Zoho CRM Synced"
        >
          <div className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Zoho CRM Synced</div>
          <div className="text-2xl font-bold text-orange-600 mt-1">{stats.zohoSynced}</div>
        </button>

        {/* Categories */}
        <button
          type="button"
          onClick={() => {
            setEditingCategory(null);
            setCategoryFormData({
              name: '',
              slug: '',
              code: '',
              description: '',
              iconUrl: '',
              displayOrder: 0,
              isActive: true,
            });
            setIsCategoryModalOpen(true);
          }}
          className="text-left p-4 rounded-xl border border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50/40 transition-all duration-150 shadow-sm cursor-pointer hover:shadow-md active:scale-[0.98] group"
          title="Open Categories Management Modal"
        >
          <div className="text-xs font-semibold text-purple-600 uppercase tracking-wider flex items-center justify-between">
            <span>Categories</span>
            <Layers className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition" />
          </div>
          <div className="text-2xl font-bold text-purple-600 mt-1">{categories.length}</div>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by organization, contact, email, phone, city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F8A3E] focus:bg-white transition"
            />
          </div>

          {/* Dynamic Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F8A3E] focus:bg-white transition"
            >
              <option value="ALL">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F8A3E] focus:bg-white transition"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Review</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          {/* Website Publishing Filter */}
          <div>
            <select
              value={selectedPublish}
              onChange={(e) => setSelectedPublish(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F8A3E] focus:bg-white transition"
            >
              <option value="ALL">All Visibility</option>
              <option value="PUBLISHED">🌐 Live on Website</option>
              <option value="HIDDEN">🔒 Hidden from Website</option>
            </select>
          </div>
        </div>
      </div>

      {/* Partners List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-gray-200">
          <RefreshCw className="w-8 h-8 text-[#1F8A3E] animate-spin mb-2" />
          <p className="text-sm text-gray-500">Loading partners from database...</p>
        </div>
      ) : filteredPartners.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-gray-200 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mb-3" />
          <h3 className="text-base font-semibold text-gray-800">No Partners Found</h3>
          <p className="text-sm text-gray-500 max-w-md mt-1">
            {searchTerm || selectedCategory !== 'ALL' || selectedStatus !== 'ALL'
              ? 'No partners match your selected filters. Try resetting the filters.'
              : 'You have not added any partners yet. Add a partner directly or sync applications from Zoho CRM.'}
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#1F8A3E] text-white rounded-lg hover:bg-[#186e32] transition"
          >
            <Plus className="w-4 h-4" />
            Add First Partner
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPartners.map((partner) => {
            const categoryName =
              partner.category?.name ||
              categories.find((c) => c.id === partner.categoryId)?.name ||
              partner.type ||
              'General Partner';

            return (
              <div
                key={partner.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                {/* Optional Cover Banner */}
                {(partner.bannerImageUrl || (partner.photos && partner.photos.length > 0)) && (
                  <div className="relative h-32 w-full bg-gray-100 overflow-hidden border-b border-gray-100">
                    <img
                      src={partner.bannerImageUrl || partner.photos?.[0]}
                      alt={partner.organizationName || partner.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    {partner.photos && partner.photos.length > 0 && (
                      <span className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                        <ImageIcon className="w-3 h-3" />
                        {partner.photos.length} {partner.photos.length === 1 ? 'photo' : 'photos'}
                      </span>
                    )}
                  </div>
                )}

                <div className="p-5 space-y-4">
                  {/* Card Header: Category & Source */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Tag className="w-3 h-3" />
                      {categoryName}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {partner.source === 'ZOHO_CRM' && (
                        <button
                          type="button"
                          onClick={() => setZohoPayloadViewerPartner(partner)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition"
                          title="View Zoho CRM Sync Data"
                        >
                          <Database className="w-3 h-3" />
                          Zoho CRM
                        </button>
                      )}
                      {partner.isFeatured && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          <Sparkles className="w-3 h-3" />
                          Featured
                        </span>
                      )}
                      {((partner.documents && partner.documents.length > 0) || partner.attachmentUrl) && (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200"
                          title="Compliance Documents Attached"
                        >
                          <Paperclip className="w-3 h-3" />
                          {partner.documents && partner.documents.length > 0 ? partner.documents.length : 1} {partner.documents && partner.documents.length === 1 ? 'doc' : 'docs'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Organization Title */}
                  <div>
                    <h3 className="text-base font-bold text-gray-900 leading-snug">
                      {partner.organizationName || partner.name}
                    </h3>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                      {partner.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Contact & Location Info */}
                  <div className="space-y-1.5 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    {(partner.primaryContactName || partner.contactPerson) && (
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="font-medium text-gray-800">
                          {partner.primaryContactName || partner.contactPerson}
                        </span>
                      </div>
                    )}
                    {partner.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <a href={`tel:${partner.phone}`} className="hover:text-[#1F8A3E] transition">
                          {partner.phone}
                        </a>
                      </div>
                    )}
                    {partner.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <a href={`mailto:${partner.email}`} className="truncate hover:text-[#1F8A3E] transition">
                          {partner.email}
                        </a>
                      </div>
                    )}
                    {(partner.city || partner.state || partner.address) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">
                          {[partner.city, partner.state, partner.address].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Service Highlights / Badges */}
                  {partner.serviceHighlights && partner.serviceHighlights.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {partner.serviceHighlights.slice(0, 3).map((highlight, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md border border-gray-200"
                        >
                          {highlight}
                        </span>
                      ))}
                      {partner.serviceHighlights.length > 3 && (
                        <span className="text-[11px] px-1.5 py-0.5 text-gray-400">
                          +{partner.serviceHighlights.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Website Live Toggle & Status */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <select
                        value={partner.status}
                        onChange={(e) => handleStatusChange(partner.id, e.target.value as PartnerStatus)}
                        className={`text-xs font-semibold px-2 py-1 rounded-md border focus:outline-none transition ${
                          partner.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : partner.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : partner.status === 'IN_REVIEW'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="IN_REVIEW">IN_REVIEW</option>
                        <option value="APPROVED">APPROVED</option>
                        <option value="REJECTED">REJECTED</option>
                        <option value="ARCHIVED">ARCHIVED</option>
                      </select>
                    </div>

                    {/* Website Live Toggle */}
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(partner)}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all ${
                        partner.isPublished
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                          : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200'
                      }`}
                      title="Click to toggle website visibility"
                    >
                      <Globe className="w-3 h-3" />
                      {partner.isPublished ? 'Live on Website' : 'Hidden'}
                    </button>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs">
                  <span className="text-gray-400">
                    {partner.createdAt ? new Date(partner.createdAt).toLocaleDateString() : 'Active'}
                  </span>
                  <div className="flex items-center gap-2">
                    {partner.websiteUrl && (
                      <a
                        href={partner.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-white rounded border border-transparent hover:border-gray-200 transition"
                        title="Open Partner Website"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => handleOpenEditModal(partner)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-gray-700 border border-gray-200 rounded hover:bg-gray-100 font-medium transition"
                    >
                      <Edit2 className="w-3 h-3 text-gray-500" />
                      Edit Details
                    </button>
                    <button
                      onClick={() => handleDeletePartner(partner)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition"
                      title="Delete Partner"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT PARTNER MODAL                                                  */}
      {/* ========================================================================= */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedPartner ? 'Edit Partner Details' : 'Add New Partner Directly'}
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedPartner?.source === 'ZOHO_CRM'
                    ? 'Synced from Zoho CRM — Admin has full access to edit and publish on website.'
                    : 'Configure partner information and website presentation parameters.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                  setSelectedPartner(null);
                }}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSavePartner} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Organization Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Organisation Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={partnerFormData.organizationName || ''}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, organizationName: e.target.value })}
                    placeholder="e.g. Apex Diagnostics & Lab Care"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F8A3E] focus:outline-none"
                  />
                </div>

                {/* Dynamic Category */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Partner Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={partnerFormData.categoryId || ''}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F8A3E] focus:outline-none bg-white"
                  >
                    <option value="" disabled>
                      Select Category
                    </option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Workflow Status</label>
                  <select
                    value={partnerFormData.status || 'PENDING'}
                    onChange={(e) =>
                      setPartnerFormData({ ...partnerFormData, status: e.target.value as PartnerStatus })
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F8A3E] focus:outline-none bg-white"
                  >
                    <option value="PENDING">Pending Review</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>

                {/* Description */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Brief Description <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={partnerFormData.description || ''}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, description: e.target.value })}
                    placeholder="Provide details about their services, coverage, and specialization..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F8A3E] focus:outline-none"
                  />
                </div>

                {/* Primary Contact Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Primary Contact Name</label>
                  <input
                    type="text"
                    value={partnerFormData.primaryContactName || ''}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, primaryContactName: e.target.value })}
                    placeholder="e.g. Dr. Rajesh Sharma"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F8A3E] focus:outline-none"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={partnerFormData.phone || ''}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, phone: e.target.value })}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F8A3E] focus:outline-none"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={partnerFormData.email || ''}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, email: e.target.value })}
                    placeholder="e.g. info@apexcare.com"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F8A3E] focus:outline-none"
                  />
                </div>

                {/* City & State */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={partnerFormData.city || ''}
                      onChange={(e) => setPartnerFormData({ ...partnerFormData, city: e.target.value })}
                      placeholder="e.g. Jaipur"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F8A3E] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={partnerFormData.state || ''}
                      onChange={(e) => setPartnerFormData({ ...partnerFormData, state: e.target.value })}
                      placeholder="e.g. Rajasthan"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F8A3E] focus:outline-none"
                    />
                  </div>
                </div>

                {/* --- Website Presentation Controls --- */}
                <div className="sm:col-span-2 pt-3 border-t border-gray-200">
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#1F8A3E]" />
                    Website Presentation & Publishing Controls
                  </h4>
                </div>

                {/* Website URL */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Partner Website URL</label>
                  <input
                    type="url"
                    value={partnerFormData.websiteUrl || ''}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, websiteUrl: e.target.value })}
                    placeholder="https://apexcare.com"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F8A3E] focus:outline-none"
                  />
                </div>

                {/* Custom Badge Text */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Custom Badge Text</label>
                  <input
                    type="text"
                    value={partnerFormData.customBadgeText || ''}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, customBadgeText: e.target.value })}
                    placeholder="e.g. 24/7 Available, NABH Accredited"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F8A3E] focus:outline-none"
                  />
                </div>

                {/* Service Highlights (Comma-separated) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Service Highlights (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={highlightsInput}
                    onChange={(e) => setHighlightsInput(e.target.value)}
                    placeholder="e.g. Home Sample Collection, 24/7 ICU Ambulance, Senior Discounts"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F8A3E] focus:outline-none"
                  />
                </div>

                {/* Publishing Toggles */}
                <div className="sm:col-span-2 flex items-center gap-6 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(partnerFormData.isPublished)}
                      onChange={(e) => setPartnerFormData({ ...partnerFormData, isPublished: e.target.checked })}
                      className="w-4 h-4 text-[#1F8A3E] rounded border-gray-300 focus:ring-[#1F8A3E]"
                    />
                    <span className="text-xs font-semibold text-gray-800">Publish Live on Website</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(partnerFormData.isFeatured)}
                      onChange={(e) => setPartnerFormData({ ...partnerFormData, isFeatured: e.target.checked })}
                      className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
                    />
                    <span className="text-xs font-semibold text-gray-800">Feature on Home / Hero</span>
                  </label>
                </div>

                {/* --- Partner Photos & Media Gallery Section --- */}
                <div className="sm:col-span-2 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-[#1F8A3E]" />
                        Partner Photos & Media Gallery
                        {partnerFormData.photos && partnerFormData.photos.length > 0 && (
                          <span className="ml-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            {partnerFormData.photos.length} {partnerFormData.photos.length === 1 ? 'photo' : 'photos'} added
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Add photos one by one. You can upload image files or paste image URLs, then set the primary cover photo for the website.
                      </p>
                    </div>
                  </div>

                  {/* Single "Add Photo" Input / Upload Bar (Visible at a time) */}
                  <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl mb-3 space-y-2">
                    <div className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-[#1F8A3E]" />
                      Add a Photo
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      {/* URL Input */}
                      <div className="flex-1 relative">
                        <input
                          type="url"
                          value={currentPhotoInput}
                          onChange={(e) => setCurrentPhotoInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddPhotoUrl();
                            }
                          }}
                          placeholder="Paste image URL (https://... or data:image) and click Add"
                          className="w-full pl-3 pr-20 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#1F8A3E] focus:outline-none"
                        />
                        {currentPhotoInput && (
                          <button
                            type="button"
                            onClick={handleAddPhotoUrl}
                            className="absolute right-1 top-1 bottom-1 px-2.5 text-xs font-semibold bg-[#1F8A3E] text-white rounded-md hover:bg-[#186e32] transition flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-400 font-medium justify-center">
                        <span>OR</span>
                      </div>

                      {/* File Upload Button */}
                      <label className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-emerald-600 bg-white text-emerald-700 hover:bg-emerald-50 cursor-pointer transition shadow-sm ${
                        isUploadingPhoto ? 'opacity-50 cursor-not-allowed' : ''
                      }`}>
                        {isUploadingPhoto ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1F8A3E]" />
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5 text-[#1F8A3E]" />
                            <span>Upload Image File</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={isUploadingPhoto}
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Display Added Photos Gallery (Grid of Added Photos) */}
                  {partnerFormData.photos && partnerFormData.photos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {partnerFormData.photos.map((photoUrl, idx) => {
                        const isCover = (partnerFormData.bannerImageUrl === photoUrl) || (!partnerFormData.bannerImageUrl && idx === 0);
                        return (
                          <div
                            key={idx}
                            className={`relative group rounded-xl overflow-hidden border-2 transition-all bg-gray-50 ${
                              isCover ? 'border-[#1F8A3E] ring-2 ring-[#1F8A3E]/20' : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="aspect-video w-full bg-gray-100 relative overflow-hidden flex items-center justify-center">
                              <img
                                src={photoUrl}
                                alt={`Photo ${idx + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = 'https://placehold.co/400x250?text=Invalid+Image';
                                }}
                              />

                              {/* Cover Badge */}
                              {isCover && (
                                <span className="absolute top-1.5 left-1.5 bg-[#1F8A3E] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1">
                                  <Star className="w-2.5 h-2.5 fill-current" /> Cover Banner
                                </span>
                              )}

                              {/* Photo Index */}
                              {!isCover && (
                                <span className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                                  #{idx + 1}
                                </span>
                              )}

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(photoUrl)}
                                className="absolute top-1.5 right-1.5 p-1 bg-rose-600/90 text-white rounded hover:bg-rose-700 transition opacity-90 group-hover:opacity-100 shadow"
                                title="Remove photo"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Set as Cover Action Bar */}
                            <div className="p-1.5 bg-white border-t border-gray-100 flex items-center justify-between">
                              {!isCover ? (
                                <button
                                  type="button"
                                  onClick={() => handleSetCoverPhoto(photoUrl)}
                                  className="w-full text-center text-[11px] font-semibold text-gray-600 hover:text-[#1F8A3E] py-0.5 hover:bg-gray-50 rounded transition flex items-center justify-center gap-1"
                                >
                                  <Star className="w-3 h-3" /> Set as Cover
                                </button>
                              ) : (
                                <span className="w-full text-center text-[11px] font-bold text-[#1F8A3E] py-0.5">
                                  ✓ Active Cover Photo
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-gray-300 text-center bg-gray-50/60">
                      <ImageIcon className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-500 font-medium">
                        No photos added yet. Use the single add box above to upload or link pictures for this partner.
                      </p>
                    </div>
                  )}
                </div>

                {/* --- Partner Documents & Compliance Section --- */}
                <div className="sm:col-span-2 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5 text-[#1F8A3E]" />
                        Partner Documents &amp; Compliance
                        {partnerFormData.documents && partnerFormData.documents.length > 0 && (
                          <span className="ml-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            {partnerFormData.documents.length} {partnerFormData.documents.length === 1 ? 'document' : 'documents'} attached
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Upload multiple compliance files, agreements, trade licenses, GST certificates, or MOU documentation.
                      </p>
                    </div>
                  </div>

                  {/* Single "Add / Upload Document" Bar */}
                  <div className="p-3.5 bg-blue-50/50 border border-blue-200/80 rounded-xl mb-3 space-y-2.5">
                    <div className="text-xs font-semibold text-blue-950 flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-blue-700" />
                      Attach Document
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Document Type Dropdown */}
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Document Type</label>
                        <select
                          value={selectedDocType}
                          onChange={(e) => setSelectedDocType(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                        >
                          <option value="MOU / Agreement">MOU / Partnership Agreement</option>
                          <option value="Registration / License">Trade License / Medical Reg</option>
                          <option value="GST Certificate">GST / Tax Certificate</option>
                          <option value="Accreditation (NABH/NABL)">NABH / NABL Accreditation</option>
                          <option value="Rate Card / Catalog">Rate Card &amp; Service Pricing</option>
                          <option value="Identity / Authority Letter">Identity / Authorization</option>
                          <option value="Company Profile">Company Profile &amp; Brochure</option>
                          <option value="Other Compliance Doc">Other Compliance Document</option>
                        </select>
                      </div>

                      {/* Optional Document Custom Title */}
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Document Title / Label</label>
                        <input
                          type="text"
                          value={customDocNameInput}
                          onChange={(e) => setCustomDocNameInput(e.target.value)}
                          placeholder="e.g. FY26 Signed MOU Agreement"
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                        />
                      </div>

                      {/* Upload Button */}
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Upload File</label>
                        <label className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-600 bg-white text-blue-700 hover:bg-blue-50 cursor-pointer transition shadow-sm ${
                          isUploadingDocument ? 'opacity-50 cursor-not-allowed' : ''
                        }`}>
                          {isUploadingDocument ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" />
                              <span>Uploading...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5 text-blue-700" />
                              <span>Upload Document File</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
                            disabled={isUploadingDocument}
                            onChange={handleDocumentFileUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Or Paste Document URL Option */}
                    <div className="pt-1.5 flex items-center gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="url"
                          value={customDocUrlInput}
                          onChange={(e) => setCustomDocUrlInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddDocumentUrl();
                            }
                          }}
                          placeholder="Or paste external doc link (Google Drive, Dropbox, PDF URL)..."
                          className="w-full pl-3 pr-20 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                        />
                        {customDocUrlInput && (
                          <button
                            type="button"
                            onClick={handleAddDocumentUrl}
                            className="absolute right-1 top-1 bottom-1 px-2 text-xs font-semibold bg-blue-700 text-white rounded-md hover:bg-blue-800 transition flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add Link
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Display List of Attached Documents */}
                  {partnerFormData.documents && partnerFormData.documents.length > 0 ? (
                    <div className="space-y-2">
                      {partnerFormData.documents.map((doc, dIdx) => (
                        <div
                          key={dIdx}
                          className="flex items-center justify-between p-2.5 bg-gray-50 hover:bg-gray-100/80 border border-gray-200 rounded-lg transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg flex-shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-900 truncate">
                                  {doc.name || `Document #${dIdx + 1}`}
                                </span>
                                {doc.documentType && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-200 text-gray-700 flex-shrink-0">
                                    {doc.documentType}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-400 truncate mt-0.5">
                                {doc.fileSizeBytes ? `${(doc.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB • ` : ''}
                                {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'Attached'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition"
                              title="Open / View Document"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View
                            </a>
                            <button
                              type="button"
                              onClick={() => handleRemoveDocument(dIdx)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition"
                              title="Delete document"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl border border-dashed border-gray-300 text-center bg-gray-50/60">
                      <Paperclip className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-500 font-medium">
                        No documents attached yet. Upload compliance files, MOUs, or licenses above.
                      </p>
                    </div>
                  )}
                </div>

                {/* Admin Internal Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Admin Internal Notes</label>
                  <textarea
                    rows={2}
                    value={partnerFormData.adminNotes || ''}
                    onChange={(e) => setPartnerFormData({ ...partnerFormData, adminNotes: e.target.value })}
                    placeholder="Log verification outcomes, MOU terms, or follow-up details..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1F8A3E] focus:outline-none"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                    setSelectedPartner(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-medium bg-[#1F8A3E] text-white rounded-lg hover:bg-[#186e32] transition shadow-sm"
                >
                  Save Partner Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DYNAMIC CATEGORIES MANAGEMENT MODAL                                       */}
      {/* ========================================================================= */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-purple-50">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-700" />
                <h3 className="text-lg font-bold text-gray-900">Dynamic Partner Categories</h3>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Category Form */}
              <form onSubmit={handleSaveCategory} className={`p-4 rounded-xl border transition-all ${editingCategory ? 'bg-purple-50/60 border-purple-300 shadow-sm' : 'bg-gray-50 border-gray-200'} space-y-3`}>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                    <span>{editingCategory ? 'Edit Category' : 'Add New Category'}</span>
                    {editingCategory && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-200 text-purple-800 normal-case">
                        Editing: {editingCategory.name}
                      </span>
                    )}
                  </h4>
                  {editingCategory && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategory(null);
                        setCategoryFormData({
                          name: '',
                          slug: '',
                          code: '',
                          description: '',
                          iconUrl: '',
                          displayOrder: 0,
                          isActive: true,
                        });
                      }}
                      className="text-xs text-purple-700 hover:underline font-medium"
                    >
                      + Add New Instead
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Category Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={categoryFormData.name || ''}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                      placeholder="e.g. Physiotherapy"
                      className="w-full px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Zoho Matching Code
                    </label>
                    <input
                      type="text"
                      value={categoryFormData.code || ''}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, code: e.target.value })}
                      placeholder="e.g. PHYSIOTHERAPY"
                      className="w-full px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Display Order</label>
                    <input
                      type="number"
                      value={categoryFormData.displayOrder ?? 0}
                      onChange={(e) =>
                        setCategoryFormData({ ...categoryFormData, displayOrder: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(categoryFormData.isActive)}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, isActive: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                    />
                    <span className="text-xs font-semibold text-gray-700">Active on Website</span>
                  </label>

                  <div className="flex items-center gap-2">
                    {editingCategory && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategory(null);
                          setCategoryFormData({
                            name: '',
                            slug: '',
                            code: '',
                            description: '',
                            iconUrl: '',
                            displayOrder: 0,
                            isActive: true,
                          });
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 shadow-sm transition"
                    >
                      {editingCategory ? 'Update Category' : 'Create Category'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Categories Table */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Existing Categories ({categories.length})</h4>
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                      <tr>
                        <th className="p-3">Category Name</th>
                        <th className="p-3">Zoho Code</th>
                        <th className="p-3">Order</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {categories.map((c) => {
                        const isBeingEdited = editingCategory?.id === c.id;
                        return (
                          <tr
                            key={c.id}
                            className={`transition ${
                              isBeingEdited
                                ? 'bg-purple-50/80 font-medium'
                                : 'hover:bg-gray-50/80'
                            }`}
                          >
                            <td className="p-3 font-semibold text-gray-900">
                              <div className="flex items-center gap-1.5">
                                {c.name}
                                {isBeingEdited && (
                                  <span className="text-[10px] bg-purple-600 text-white px-1.5 py-0.2 rounded font-normal">
                                    Editing
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-gray-500 font-mono">{c.code || '-'}</td>
                            <td className="p-3 text-gray-600">{c.displayOrder}</td>
                            <td className="p-3">
                              <button
                                type="button"
                                onClick={() => handleToggleCategoryActive(c)}
                                title="Click to toggle active status"
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition cursor-pointer hover:opacity-80 ${
                                  c.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'
                                }`}
                              >
                                {c.isActive ? 'Active' : 'Disabled'}
                              </button>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => {
                                    setEditingCategory(c);
                                    setCategoryFormData({
                                      name: c.name || '',
                                      slug: c.slug || '',
                                      code: c.code || '',
                                      description: c.description || '',
                                      iconUrl: c.iconUrl || '',
                                      displayOrder: c.displayOrder ?? 0,
                                      isActive: c.isActive ?? true,
                                    });
                                  }}
                                  className={`p-1.5 rounded transition ${
                                    isBeingEdited
                                      ? 'bg-purple-600 text-white'
                                      : 'text-purple-600 hover:text-purple-900 hover:bg-purple-50'
                                  }`}
                                  title="Edit Category"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCategory(c)}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50 transition"
                                  title="Delete Category"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ZOHO RAW PAYLOAD VIEWER MODAL                                             */}
      {/* ========================================================================= */}
      {zohoPayloadViewerPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-orange-50">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-orange-600" />
                <h3 className="text-base font-bold text-gray-900">Zoho CRM Sync Record</h3>
              </div>
              <button
                onClick={() => setZohoPayloadViewerPartner(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-3">
              <div className="text-xs text-gray-600 space-y-1">
                <div>
                  <span className="font-semibold">Zoho Lead ID:</span>{' '}
                  <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                    {zohoPayloadViewerPartner.zohoLeadId || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Synced At:</span>{' '}
                  {zohoPayloadViewerPartner.zohoSyncedAt
                    ? new Date(zohoPayloadViewerPartner.zohoSyncedAt).toLocaleString()
                    : 'N/A'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                  Raw Webhook Payload
                </label>
                <pre className="p-3 bg-gray-900 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto max-h-72">
                  {JSON.stringify(zohoPayloadViewerPartner.zohoDataPayload || {}, null, 2)}
                </pre>
              </div>
            </div>
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-right">
              <button
                onClick={() => setZohoPayloadViewerPartner(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
