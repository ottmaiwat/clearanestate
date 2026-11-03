export type ListingCategory = 
  | 'Estate Cleanouts'
  | 'Senior Move Management'
  | 'Junk Removal & Hauling'
  | 'Liquidation & Estate Sales'
  | 'Content Appraisal & Downsizing';

export interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
}

export interface Listing {
  id: string;
  name: string;
  tagline: string;
  category: ListingCategory;
  city: string;
  state: string;
  phone?: string;
  website: string;
  email?: string;
  description: string;
  services: string[];
  featured: boolean;
  rating: number;
  reviewCount: number;
  yearsInBusiness?: number;
  insured: boolean;
  bonded: boolean;
  hours?: string;
  claimed: boolean;
  address?: string;
  featuredAt?: string;
  createdAt: string;
  reviews?: Review[];
  // Approved owner uploads (shown on featured listings only).
  logoUrl?: string;
  photos?: string[];
}

export interface ClaimRequest {
  id: string;
  listingId: string;
  listingName: string;
  claimantName: string;
  claimantEmail: string;
  claimantPhone: string;
  proofDetails: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
}

export interface QuoteRequest {
  id: string;
  listingId: string;
  listingName: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  propertyType: string;
  projectScope: string;
  timeline: string;
  notes: string;
  emailed: boolean;
  submittedAt: string;
}

export interface PendingSubmission {
  id: string;
  name: string;
  category: ListingCategory;
  city: string;
  state: string;
  phone: string;
  website: string;
  email: string;
  contactName: string;
  description: string;
  services: string[];
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface FilterState {
  searchQuery: string;
  category: string;
  state: string;
  featuredOnly: boolean;
  sortBy: 'featured' | 'rating' | 'name';
}
