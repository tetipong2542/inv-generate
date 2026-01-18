import { create } from 'zustand';
import type { FreelancerConfig, Customer, ServicePackage, DocumentWithMeta, DashboardSelection, LineItem, DocumentType } from '../types';

interface EditMode {
  isEditing: boolean;
  originalDocument: DocumentWithMeta | null;
}

interface LinkedDocumentMode {
  isCreatingLinked: boolean;
  sourceDocument: DocumentWithMeta | null;
  targetType: DocumentType | null;
  linkedDocData: Partial<DocumentWithMeta> | null;
}

interface DashboardState {
  // Data
  freelancers: FreelancerConfig[];
  customers: Customer[];
  services: ServicePackage[];
  documents: DocumentWithMeta[];
  
  // Selection
  selection: DashboardSelection;
  
  // Edit mode
  editMode: EditMode;
  
  // Linked document mode (for Document Chain)
  linkedMode: LinkedDocumentMode;
  
  // Loading states
  loading: {
    freelancers: boolean;
    customers: boolean;
    services: boolean;
    documents: boolean;
  };
  
  // Actions
  setFreelancers: (freelancers: FreelancerConfig[]) => void;
  setCustomers: (customers: Customer[]) => void;
  setServices: (services: ServicePackage[]) => void;
  setDocuments: (documents: DocumentWithMeta[]) => void;
  
  selectFreelancer: (id: string | null) => void;
  selectCustomer: (id: string | null) => void;
  toggleService: (id: string) => void;
  clearServiceSelection: () => void;
  clearAllSelections: () => void;
  
  // Edit mode actions
  startEdit: (document: DocumentWithMeta) => void;
  clearEdit: () => void;
  
  // Linked document actions (Document Chain)
  startLinkedDocument: (sourceDoc: DocumentWithMeta, targetType: DocumentType, linkedData: Partial<DocumentWithMeta>) => void;
  clearLinkedDocument: () => void;
  
  setLoading: (key: keyof DashboardState['loading'], value: boolean) => void;
  
  // Computed
  getSelectedFreelancer: () => FreelancerConfig | undefined;
  getSelectedCustomer: () => Customer | undefined;
  getSelectedServices: () => ServicePackage[];
  getSelectedServiceItems: () => LineItem[];
  canQuickCreate: () => boolean;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  // Initial state
  freelancers: [],
  customers: [],
  services: [],
  documents: [],
  
  selection: {
    freelancerId: null,
    customerId: null,
    serviceIds: [],
  },
  
  editMode: {
    isEditing: false,
    originalDocument: null,
  },
  
  linkedMode: {
    isCreatingLinked: false,
    sourceDocument: null,
    targetType: null,
    linkedDocData: null,
  },
  
  loading: {
    freelancers: false,
    customers: false,
    services: false,
    documents: false,
  },
  
  // Actions
  setFreelancers: (freelancers) => set({ freelancers }),
  setCustomers: (customers) => set({ customers }),
  setServices: (services) => set({ services }),
  setDocuments: (documents) => set({ documents }),
  
  selectFreelancer: (id) => set((state) => ({
    selection: { ...state.selection, freelancerId: id },
  })),
  
  selectCustomer: (id) => set((state) => ({
    selection: { ...state.selection, customerId: id },
  })),
  
  toggleService: (id) => set((state) => {
    const serviceIds = state.selection.serviceIds.includes(id)
      ? state.selection.serviceIds.filter((sid) => sid !== id)
      : [...state.selection.serviceIds, id];
    return { selection: { ...state.selection, serviceIds } };
  }),
  
  clearServiceSelection: () => set((state) => ({
    selection: { ...state.selection, serviceIds: [] },
  })),
  
  clearAllSelections: () => set({
    selection: { freelancerId: null, customerId: null, serviceIds: [] },
  }),
  
  // Edit mode actions
  startEdit: (document) => set({
    editMode: { isEditing: true, originalDocument: document },
    linkedMode: { isCreatingLinked: false, sourceDocument: null, targetType: null, linkedDocData: null },
  }),
  
  clearEdit: () => set({
    editMode: { isEditing: false, originalDocument: null },
  }),
  
  // Linked document actions
  startLinkedDocument: (sourceDoc, targetType, linkedData) => set({
    linkedMode: { 
      isCreatingLinked: true, 
      sourceDocument: sourceDoc, 
      targetType,
      linkedDocData: linkedData,
    },
    editMode: { isEditing: false, originalDocument: null },
  }),
  
  clearLinkedDocument: () => set({
    linkedMode: { isCreatingLinked: false, sourceDocument: null, targetType: null, linkedDocData: null },
  }),
  
  setLoading: (key, value) => set((state) => ({
    loading: { ...state.loading, [key]: value },
  })),
  
  // Computed
  getSelectedFreelancer: () => {
    const { freelancers, selection } = get();
    return freelancers.find((f) => f.id === selection.freelancerId);
  },
  
  getSelectedCustomer: () => {
    const { customers, selection } = get();
    return customers.find((c) => c.id === selection.customerId);
  },
  
  getSelectedServices: () => {
    const { services, selection } = get();
    return services.filter((s) => selection.serviceIds.includes(s.id || ''));
  },
  
  getSelectedServiceItems: () => {
    const selectedServices = get().getSelectedServices();
    return selectedServices.flatMap((s) => s.items);
  },
  
  canQuickCreate: () => {
    const { selection } = get();
    return !!(selection.freelancerId && selection.customerId);
  },
}));
