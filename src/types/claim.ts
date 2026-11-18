export type ImageSlotKey = 'packaging' | 'waybill' | 'smsSummary' | 'smsDetail';

export interface ImageAsset {
  dataUrl: string;
  fileName: string;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  updatedAt: number;
}

export interface ClaimFormData {
  id: string;
  title: string;
  orderNumber: string;
  claimDate?: string;
  reasonText: string;
  images: Record<ImageSlotKey, ImageAsset | null>;
  updatedAt: number;
  createdAt: number;
}

export interface SlotDefinition {
  key: ImageSlotKey;
  stepNumber: number;
  headerLabel: string;
  description: string;
  hint: string;
}

export const IMAGE_SLOTS: SlotDefinition[] = [
  {
    key: 'packaging',
    stepNumber: 2,
    headerLabel: '포장상태',
    description: '반품 수거된 상품의 실제 포장 및 제품 상태 사진을 넣어주세요.',
    hint: '줄자나 제품 규격, 박스 상태가 잘 보이도록 촬영한 사진 권장',
  },
  {
    key: 'waybill',
    stepNumber: 3,
    headerLabel: '운송장',
    description: '반품 택배 운송장(등기번호/송장번호 포함) 사진을 넣어주세요.',
    hint: '운송장 번호, 발송인/수취인 정보가 선명하게 보이는 사진 권장',
  },
  {
    key: 'smsSummary',
    stepNumber: 4,
    headerLabel: '문자전송내용',
    description: 'ERP 또는 문자 발송 내역 전체 화면 캡처를 넣어주세요.',
    hint: 'Win+Shift+S 캡처 후 이 영역을 클릭해 Ctrl+V로 바로 붙여넣기 가능',
  },
  {
    key: 'smsDetail',
    stepNumber: 5,
    headerLabel: '문자전송 자세히',
    description: '고객에게 안내한 문자 발송 상세 내용 캡처를 넣어주세요.',
    hint: '발신시간, 수신번호, 안내 문구 전문이 포함되도록 캡처 권장',
  },
];

export const REASON_PRESETS: { label: string; text: string }[] = [
  {
    label: '브랜드/사이즈 오주문',
    text: '고객이 브랜드나 사이즈를 잘못 주문함\n판매자귀책아님.',
  },
  {
    label: '고객 단순 변심',
    text: '고객 단순 변심으로 인한 반품 요청 (오배송 및 상품 파손 아님)\n판매자 귀책 사유 없음, 반품 배송비 보상 신청.',
  },
  {
    label: '옵션/수량 착오 주문',
    text: '고객이 상품 옵션 또는 수량을 착오하여 잘못 주문함\n정상 출고 완료 건으로 판매자 귀책 아님.',
  },
  {
    label: '수취인 부재/주소 불명',
    text: '수취인 주소 불명 및 연락 두절로 인한 반송 건\n정상 발송 완료 후 반송되어 판매자 귀책 아님.',
  },
];
