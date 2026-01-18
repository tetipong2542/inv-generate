import React from 'react';
import { Building2, User, Globe, Check, Calculator } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import type { DocumentProfile, TaxConfig, TaxBreakdown } from '@/types';

// Default Document Profiles
export const DEFAULT_PROFILES: DocumentProfile[] = [
  // บริษัท - Option 1: VAT 7% + WHT 3% (ปกติ)
  {
    id: 'company-standard',
    name: 'บริษัท (มาตรฐาน)',
    icon: 'Building2',
    description: 'VAT 7% + หัก ณ ที่จ่าย 3%',
    category: 'company',
    taxConfig: {
      vat: { enabled: true, rate: 0.07 },
      withholding: { enabled: true, rate: 0.03 },
      grossUp: false,
    },
    defaultPaymentTerms: ['ชำระภายใน 30 วันหลังได้รับใบแจ้งหนี้'],
  },
  // บริษัท - Option 2: Gross-up (ลูกค้าจ่ายภาษี)
  {
    id: 'company-grossup',
    name: 'บริษัท (Gross-up)',
    icon: 'Building2',
    description: 'VAT 7% + WHT 3% ลูกค้าจ่าย',
    category: 'company',
    taxConfig: {
      vat: { enabled: true, rate: 0.07 },
      withholding: { enabled: true, rate: 0.03 },
      grossUp: true,
    },
    defaultPaymentTerms: ['ชำระภายใน 30 วันหลังได้รับใบแจ้งหนี้'],
    defaultNotes: 'ราคารวมภาษีที่ลูกค้ารับผิดชอบแล้ว',
  },
  // บุคคล - Option 1: WHT 3% (ปกติ)
  {
    id: 'individual-standard',
    name: 'บุคคลธรรมดา',
    icon: 'User',
    description: 'หัก ณ ที่จ่าย 3%',
    category: 'individual',
    taxConfig: {
      vat: { enabled: false, rate: 0 },
      withholding: { enabled: true, rate: 0.03 },
      grossUp: false,
    },
    defaultPaymentTerms: ['ชำระเต็มจำนวนก่อนเริ่มงาน'],
  },
  // บุคคล - Option 2: Gross-up (ลูกค้าจ่าย WHT)
  {
    id: 'individual-grossup',
    name: 'บุคคล (Gross-up)',
    icon: 'User',
    description: 'WHT 3% ลูกค้าจ่าย',
    category: 'individual',
    taxConfig: {
      vat: { enabled: false, rate: 0 },
      withholding: { enabled: true, rate: 0.03 },
      grossUp: true,
    },
    defaultPaymentTerms: ['ชำระเต็มจำนวนก่อนเริ่มงาน'],
    defaultNotes: 'ราคารวมภาษีหัก ณ ที่จ่ายที่ลูกค้ารับผิดชอบแล้ว',
  },
  // ต่างประเทศ
  {
    id: 'overseas',
    name: 'ต่างประเทศ',
    icon: 'Globe',
    description: 'ไม่มีภาษี',
    category: 'overseas',
    taxConfig: {
      vat: { enabled: false, rate: 0 },
      withholding: { enabled: false, rate: 0 },
      grossUp: false,
    },
    defaultPaymentTerms: ['Payment in advance before work starts'],
    defaultNotes: 'International client - No Thai tax applicable',
  },
];

// Calculate tax with gross-up support
export function calculateTaxBreakdown(subtotal: number, taxConfig: TaxConfig): TaxBreakdown {
  const { vat, withholding, grossUp } = taxConfig;
  
  if (grossUp) {
    // Gross-up calculation: บวกราคาให้ลูกค้าจ่ายภาษีแทน
    // สูตร: ถ้าต้องการรับสุทธิ X บาท
    // - กรณี VAT + WHT: grossAmount = X / (1 + VAT - WHT)
    // - กรณี WHT อย่างเดียว: grossAmount = X / (1 - WHT)
    
    let grossAmount = subtotal;
    let vatAmount = 0;
    let withholdingAmount = 0;
    
    if (vat.enabled && withholding.enabled) {
      // บริษัท: VAT 7% + WHT 3%
      // สูตร: grossAmount = subtotal / (1 + 0.07 - 0.03) = subtotal / 1.04
      grossAmount = subtotal / (1 + vat.rate - withholding.rate);
      vatAmount = grossAmount * vat.rate;
      withholdingAmount = grossAmount * withholding.rate;
    } else if (withholding.enabled && !vat.enabled) {
      // บุคคล: WHT 3% อย่างเดียว
      // สูตร: grossAmount = subtotal / (1 - 0.03) = subtotal / 0.97
      grossAmount = subtotal / (1 - withholding.rate);
      withholdingAmount = grossAmount * withholding.rate;
    } else if (vat.enabled && !withholding.enabled) {
      // VAT อย่างเดียว (ไม่ค่อยมี)
      grossAmount = subtotal / (1 + vat.rate);
      vatAmount = grossAmount * vat.rate;
    }
    
    const grossUpAmount = grossAmount - subtotal / (1 + vat.rate - withholding.rate) * (1 + vat.rate - withholding.rate);
    
    return {
      subtotal: Math.round(grossAmount * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      withholdingAmount: Math.round(withholdingAmount * 100) / 100,
      total: subtotal, // รับสุทธิ = ราคาที่ตั้งไว้
      grossUpAmount: Math.round((grossAmount - subtotal) * 100) / 100,
    };
  } else {
    // Normal calculation
    const vatAmount = vat.enabled ? subtotal * vat.rate : 0;
    const withholdingAmount = withholding.enabled ? subtotal * withholding.rate : 0;
    const total = subtotal + vatAmount - withholdingAmount;
    
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      withholdingAmount: Math.round(withholdingAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }
}

// Recalculate gross-up: Given desired net amount, calculate what to charge
export function calculateGrossUpPrice(desiredNet: number, taxConfig: TaxConfig): number {
  const { vat, withholding } = taxConfig;
  
  if (vat.enabled && withholding.enabled) {
    // VAT 7% + WHT 3%
    // net = gross + (gross * 0.07) - (gross * 0.03)
    // net = gross * (1 + 0.07 - 0.03) = gross * 1.04
    // gross = net / 1.04
    return desiredNet / (1 + vat.rate - withholding.rate);
  } else if (withholding.enabled && !vat.enabled) {
    // WHT only
    // net = gross - (gross * 0.03) = gross * 0.97
    // gross = net / 0.97
    return desiredNet / (1 - withholding.rate);
  } else if (vat.enabled && !withholding.enabled) {
    // VAT only
    // net = gross + (gross * 0.07) = gross * 1.07
    // gross = net / 1.07
    return desiredNet / (1 + vat.rate);
  }
  
  return desiredNet;
}

interface ProfileCardProps {
  profile: DocumentProfile;
  isSelected: boolean;
  onClick: () => void;
  subtotal: number;
}

function ProfileCard({ profile, isSelected, onClick, subtotal }: ProfileCardProps) {
  const breakdown = calculateTaxBreakdown(subtotal, profile.taxConfig);
  
  const IconComponent = {
    Building2: Building2,
    User: User,
    Globe: Globe,
  }[profile.icon] || Building2;
  
  const categoryColors = {
    company: 'border-blue-200 bg-blue-50 hover:bg-blue-100',
    individual: 'border-green-200 bg-green-50 hover:bg-green-100',
    overseas: 'border-purple-200 bg-purple-50 hover:bg-purple-100',
  };
  
  const selectedColors = {
    company: 'ring-2 ring-blue-500 border-blue-500',
    individual: 'ring-2 ring-green-500 border-green-500',
    overseas: 'ring-2 ring-purple-500 border-purple-500',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative p-3 sm:p-4 rounded-lg border-2 transition-all text-left w-full touch-manipulation',
        categoryColors[profile.category],
        isSelected && selectedColors[profile.category]
      )}
    >
      {isSelected && (
        <div className="absolute top-2 right-2">
          <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
        </div>
      )}
      
      <div className="flex items-start gap-2 sm:gap-3">
        <div className={cn(
          'p-1.5 sm:p-2 rounded-lg flex-shrink-0',
          profile.category === 'company' && 'bg-blue-200',
          profile.category === 'individual' && 'bg-green-200',
          profile.category === 'overseas' && 'bg-purple-200',
        )}>
          <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-xs sm:text-sm">{profile.name}</h4>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{profile.description}</p>
          
          {profile.taxConfig.grossUp && (
            <div className="flex items-center gap-1 mt-1">
              <Calculator className="w-3 h-3 text-orange-600" />
              <span className="text-xs text-orange-600 font-medium">Gross-up</span>
            </div>
          )}
          
          {subtotal > 0 && (
            <div className="mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-current/10 space-y-0.5">
              {profile.taxConfig.grossUp && breakdown.grossUpAmount ? (
                <>
                  <div className="flex justify-between text-xs">
                    <span>เรียกเก็บ</span>
                    <span className="font-medium">{formatNumber(breakdown.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-green-700 font-medium">
                    <span>รับสุทธิ</span>
                    <span>{formatNumber(breakdown.total)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-xs">
                  <span>รับสุทธิ</span>
                  <span className="font-medium text-green-700">{formatNumber(breakdown.total)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

interface DocumentProfileSelectorProps {
  selectedProfileId: string | null;
  onSelectProfile: (profile: DocumentProfile) => void;
  subtotal: number;
}

export function DocumentProfileSelector({
  selectedProfileId,
  onSelectProfile,
  subtotal,
}: DocumentProfileSelectorProps) {
  const groupedProfiles = {
    company: DEFAULT_PROFILES.filter(p => p.category === 'company'),
    individual: DEFAULT_PROFILES.filter(p => p.category === 'individual'),
    overseas: DEFAULT_PROFILES.filter(p => p.category === 'overseas'),
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Company Profiles */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
          <Building2 className="w-3 h-3" /> บริษัท / นิติบุคคล
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {groupedProfiles.company.map(profile => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isSelected={selectedProfileId === profile.id}
              onClick={() => onSelectProfile(profile)}
              subtotal={subtotal}
            />
          ))}
        </div>
      </div>
      
      {/* Individual Profiles */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
          <User className="w-3 h-3" /> บุคคลธรรมดา
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {groupedProfiles.individual.map(profile => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isSelected={selectedProfileId === profile.id}
              onClick={() => onSelectProfile(profile)}
              subtotal={subtotal}
            />
          ))}
        </div>
      </div>
      
      {/* Overseas Profile */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
          <Globe className="w-3 h-3" /> ลูกค้าต่างประเทศ
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {groupedProfiles.overseas.map(profile => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isSelected={selectedProfileId === profile.id}
              onClick={() => onSelectProfile(profile)}
              subtotal={subtotal}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
