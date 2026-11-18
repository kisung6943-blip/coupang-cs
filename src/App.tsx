import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookmarkCheck,
  Check,
  Download,
  FolderOpen,
  RotateCcw,
  X,
} from 'lucide-react';
import { ImageSlotCard } from './components/ImageSlotCard';
import { SavedClaimsView } from './components/SavedClaimsView';
import {
  ClaimFormData,
  IMAGE_SLOTS,
  ImageAsset,
  ImageSlotKey,
} from './types/claim';
import {
  exportClaimAsImage,
  getDefaultFileNameBase,
  getTodayDateString,
  readImageFileAsAsset,
  triggerBlobDownload,
} from './utils/canvasExporter';
import {
  deleteClaimRecord,
  listClaimRecords,
  loadActiveDraft,
  saveActiveDraft,
  saveClaimRecord,
} from './utils/storage';

type AppTab = 'editor' | 'saved' | 'guide';

interface ToastState {
  id: number;
  message: string;
  type: 'info' | 'error';
}

function createEmptyClaim(): ClaimFormData {
  const now = Date.now();
  return {
    id: `claim_${now}_${Math.random().toString(36).slice(2, 7)}`,
    title: '',
    orderNumber: '',
    claimDate: getTodayDateString(),
    reasonText: '',
    images: {
      packaging: null,
      waybill: null,
      smsSummary: null,
      smsDetail: null,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('editor');
  const [claim, setClaim] = useState<ClaimFormData>(() => createEmptyClaim());
  const [savedRecords, setSavedRecords] = useState<ClaimFormData[]>([]);
  const [activeSlot, setActiveSlot] = useState<ImageSlotKey>('packaging');
  const [isExporting, setIsExporting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<{
    asset: ImageAsset;
    label: string;
  } | null>(null);
  const [customFileName, setCustomFileName] = useState<string>('');
  const [saveModalTarget, setSaveModalTarget] = useState<ClaimFormData | null>(null);
  const [modalFileName, setModalFileName] = useState<string>('');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const modalFileNameInputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((message: string, type: 'info' | 'error' = 'info') => {
    setToast({ id: Date.now(), message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Initial load from IndexedDB
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [draft, records] = await Promise.all([
        loadActiveDraft(),
        listClaimRecords(),
      ]);
      if (!mounted) return;
      if (draft) {
        setClaim({
          ...draft,
          claimDate: draft.claimDate || getTodayDateString(),
        });
      }
      setSavedRecords(records);
      setIsHydrated(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Auto-save working draft to IndexedDB
  useEffect(() => {
    if (!isHydrated) return;
    const timer = window.setTimeout(() => {
      void saveActiveDraft(claim);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [claim, isHydrated]);

  const updateReasonText = (text: string) => {
    setClaim((prev) => ({
      ...prev,
      reasonText: text,
      updatedAt: Date.now(),
    }));
  };

  const updateSlotImage = useCallback(
    (key: ImageSlotKey, asset: ImageAsset | null) => {
      setClaim((prev) => ({
        ...prev,
        images: {
          ...prev.images,
          [key]: asset,
        },
        updatedAt: Date.now(),
      }));
    },
    []
  );

  // Global paste handler for quick screenshot pasting
  useEffect(() => {
    if (activeTab !== 'editor') return;

    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }
      // If event already came from an ImageSlotCard, let its onPaste handle it
      if (target?.closest('[id^="slot-"]')) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;
          e.preventDefault();
          const firstEmpty = IMAGE_SLOTS.find((s) => !claim.images[s.key])?.key;
          const destination = claim.images[activeSlot]
            ? firstEmpty ?? activeSlot
            : activeSlot;
          try {
            const asset = await readImageFileAsAsset(file);
            updateSlotImage(destination, asset);
            setActiveSlot(destination);
            const def = IMAGE_SLOTS.find((s) => s.key === destination);
            notify(
              `${def?.stepNumber ?? ''}번 ${def?.headerLabel ?? ''}에 붙여넣었습니다.`
            );
          } catch {
            notify('클립보드 이미지를 읽지 못했습니다.', 'error');
          }
          return;
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [activeTab, activeSlot, claim.images, notify, updateSlotImage]);

  const attachedCount = IMAGE_SLOTS.filter((s) => Boolean(claim.images[s.key])).length;

  const handleExportJpg = async (targetClaim: ClaimFormData = claim) => {
    const targetImageCount = IMAGE_SLOTS.filter((s) =>
      Boolean(targetClaim.images[s.key])
    ).length;
    if (!targetClaim.reasonText.trim() && targetImageCount === 0) {
      notify('저장할 보상신청내용 또는 사진을 먼저 입력해 주세요.', 'error');
      return;
    }

    setIsExporting(true);
    try {
      const autoFileName = getDefaultFileNameBase(targetClaim);
      const { blob, fileName } = await exportClaimAsImage(
        targetClaim,
        'image/jpeg',
        false,
        autoFileName
      );
      triggerBlobDownload(blob, fileName);
      notify(`${fileName} 파일로 자동 저장되었습니다.`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : '이미지 저장 중 오류가 발생했습니다.';
      notify(msg, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveToArchive = async () => {
    if (!claim.reasonText.trim() && attachedCount === 0) {
      notify('보관함에 저장할 내용이나 사진을 먼저 입력해 주세요.', 'error');
      return;
    }

    const fallbackTitle =
      claim.title.trim() ||
      claim.orderNumber.trim() ||
      claim.reasonText.trim().split('\n')[0]?.slice(0, 24) ||
      `보상신청_${new Date().toLocaleDateString('ko-KR')}`;

    const recordToSave: ClaimFormData = {
      ...claim,
      title: fallbackTitle,
      updatedAt: Date.now(),
    };

    try {
      await saveClaimRecord(recordToSave);
      setClaim(recordToSave);
      const updatedList = await listClaimRecords();
      setSavedRecords(updatedList);
      notify('보관함에 저장되었습니다.');
    } catch {
      notify('보관함 저장 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleLoadClaim = (target: ClaimFormData) => {
    setClaim(target);
    setCustomFileName('');
    setActiveTab('editor');
    notify(`'${target.title || '저장된 양식'}'을 불러왔습니다.`);
  };

  const handleDeleteClaim = async (id: string) => {
    try {
      await deleteClaimRecord(id);
      const updatedList = await listClaimRecords();
      setSavedRecords(updatedList);
      notify('보관함에서 삭제되었습니다.');
    } catch {
      notify('삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleCreateNew = () => {
    setClaim(createEmptyClaim());
    setCustomFileName('');
    setConfirmReset(false);
    setActiveTab('editor');
    notify('새 보상신청 양식을 시작합니다.');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar: strict 3-zone contract */}
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 sm:px-6 h-16">
          {/* Zone 1: Brand wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            쿠팡 배송비 보상신청 양식
          </button>

          {/* Zone 2: Clean single-line nav links */}
          <nav className="flex items-center gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'editor'
                  ? 'text-slate-900 font-semibold border-b-2 border-slate-900'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              양식 작성
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                activeTab === 'saved'
                  ? 'text-slate-900 font-semibold border-b-2 border-slate-900'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              저장 보관함 ({savedRecords.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'guide'
                  ? 'text-slate-900 font-semibold border-b-2 border-slate-900'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              작성 안내
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="shrink-0">
            <button
              type="button"
              disabled={isExporting}
              onClick={() => void handleExportJpg(claim)}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {isExporting ? '생성 중...' : 'JPG 저장'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {activeTab === 'saved' ? (
          <SavedClaimsView
            records={savedRecords}
            currentId={claim.id}
            onLoadClaim={handleLoadClaim}
            onDownloadClaim={(target) => void handleExportJpg(target)}
            onDeleteClaim={(id) => void handleDeleteClaim(id)}
            onCreateNew={handleCreateNew}
          />
        ) : activeTab === 'guide' ? (
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
            <div className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8">
              <h1 className="text-xl font-bold text-slate-900">
                쿠팡 배송비 보상신청 양식 작성 안내
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                쿠팡 Wing 배송비 보상신청 시 제출하는 5단계 증빙 자료를 한 장의 깔끔한 JPG 이미지 파일로 합쳐서 저장할 수 있습니다.
              </p>

              <div className="mt-6 divide-y divide-slate-200 border-t border-slate-200">
                <div className="py-4 flex gap-4">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded bg-slate-900 font-mono text-xs font-semibold text-white tabular-nums">
                    1
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">보상신청내용 (텍스트 입력)</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      고객 오주문, 단순 변심 등 판매자 귀책이 아님을 명확히 작성합니다.
                    </p>
                  </div>
                </div>
                {IMAGE_SLOTS.map((slot) => (
                  <div key={slot.key} className="py-4 flex gap-4">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded bg-slate-900 font-mono text-xs font-semibold text-white tabular-nums">
                      {slot.stepNumber}
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">
                        {slot.headerLabel} (사진 첨부)
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">{slot.description}</p>
                      <p className="mt-1 text-xs text-slate-500">{slot.hint}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-md bg-slate-50 border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900">빠른 작업 팁</h3>
                <ul className="mt-2 space-y-1.5 text-sm text-slate-600 list-disc pl-5">
                  <li>
                    컴퓨터에서 <span className="font-mono text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded">Win + Shift + S</span> 로 ERP 화면을 캡처한 뒤, 4번이나 5번 칸을 클릭하고 <span className="font-mono text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded">Ctrl + V</span> 를 누르면 파일 저장 없이 바로 들어갑니다.
                  </li>
                  <li>
                    스마트폰으로 찍은 운송장이나 포장 사진이 가로로 누워 있으면 각 카드 우측 상단의 <strong>회전</strong> 버튼을 눌러 바로 세울 수 있습니다.
                  </li>
                  <li>
                    <strong>JPG 저장</strong>을 누르면 1~5번 항목이 한 장의 세로 문서 JPG 이미지로 자동 변환되어 다운로드됩니다.
                  </li>
                </ul>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveTab('editor')}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  양식 작성으로 돌아가기
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
            <div className="no-print space-y-5">
                {/* Document Metadata & Quick Actions */}
                <section className="rounded-lg border border-slate-200 bg-white p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label
                        htmlFor="claim-title"
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        성함
                      </label>
                      <input
                        id="claim-title"
                        type="text"
                        value={claim.title}
                        onChange={(e) =>
                          setClaim((prev) => ({
                            ...prev,
                            title: e.target.value,
                            updatedAt: Date.now(),
                          }))
                        }
                        placeholder="예: 홍길동"
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="claim-order-number"
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        송장번호
                      </label>
                      <input
                        id="claim-order-number"
                        type="text"
                        value={claim.orderNumber}
                        onChange={(e) =>
                          setClaim((prev) => ({
                            ...prev,
                            orderNumber: e.target.value,
                            updatedAt: Date.now(),
                          }))
                        }
                        placeholder="예: 12104202353764"
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="claim-date"
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        날짜
                      </label>
                      <input
                        id="claim-date"
                        type="date"
                        value={claim.claimDate || getTodayDateString()}
                        onChange={(e) =>
                          setClaim((prev) => ({
                            ...prev,
                            claimDate: e.target.value,
                            updatedAt: Date.now(),
                          }))
                        }
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">
                      JPG 자동 저장 파일명:{' '}
                      <strong className="font-semibold text-slate-800">
                        {getDefaultFileNameBase(claim)}.jpg
                      </strong>
                    </span>

                    {confirmReset ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-red-600 font-medium">
                          모두 비울까요?
                        </span>
                        <button
                          type="button"
                          onClick={handleCreateNew}
                          className="rounded border border-red-200 bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 cursor-pointer"
                        >
                          확인
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmReset(false)}
                          className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmReset(true)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        새로 작성
                      </button>
                    )}
                  </div>
                </section>

                {/* 1번: 보상신청내용 */}
                <section className="rounded-lg border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded bg-slate-900 font-mono text-xs font-semibold text-white tabular-nums">
                        1
                      </span>
                      <h2 className="text-base font-bold text-slate-900">
                        보상신청내용
                      </h2>
                    </div>
                    <span className="font-mono text-xs text-slate-400 tabular-nums">
                      {claim.reasonText.length}자
                    </span>
                  </div>

                  <textarea
                    ref={reasonRef}
                    rows={3}
                    value={claim.reasonText}
                    onChange={(e) => updateReasonText(e.target.value)}
                    placeholder={'고객이 브랜드나 사이즈를 잘못 주문함\n판매자귀책아님.'}
                    className="mt-3 w-full rounded-md border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none resize-y"
                  />
                </section>

                {/* 2~5번: 사진 업로드 슬롯 */}
                {IMAGE_SLOTS.map((slot) => (
                  <ImageSlotCard
                    key={slot.key}
                    slot={slot}
                    asset={claim.images[slot.key]}
                    isActive={activeSlot === slot.key}
                    onFocusSlot={() => setActiveSlot(slot.key)}
                    onChange={(asset) => updateSlotImage(slot.key, asset)}
                    onPreviewZoom={(asset, label) => setZoomedImage({ asset, label })}
                    onNotify={notify}
                  />
                ))}
            </div>
          </div>
        )}
      </main>

      {/* Save File Name Modal */}
      {saveModalTarget && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => !isExporting && setSaveModalTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                파일명 지정하여 JPG 저장
              </h3>
              <button
                type="button"
                onClick={() => setSaveModalTarget(null)}
                disabled={isExporting}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-1.5 text-xs text-slate-500">
              저장할 JPG 이미지 파일 이름을 입력해 주세요.
            </p>

            <form
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                void executeExportJpg(saveModalTarget, modalFileName, false);
              }}
            >
              <label
                htmlFor="modal-file-name"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                파일명
              </label>
              <div className="relative">
                <input
                  ref={modalFileNameInputRef}
                  id="modal-file-name"
                  type="text"
                  value={modalFileName}
                  onChange={(e) => setModalFileName(e.target.value)}
                  placeholder={getDefaultFileNameBase(saveModalTarget)}
                  className="w-full rounded-md border border-slate-300 bg-white pl-3 pr-12 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs font-semibold text-slate-400">
                  .jpg
                </span>
              </div>

              <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => setSaveModalTarget(null)}
                  className="rounded-md border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() =>
                    void executeExportJpg(saveModalTarget, modalFileName, true)
                  }
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 cursor-pointer disabled:opacity-50"
                  title="저장할 폴더와 파일명을 탐색기에서 직접 지정"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  폴더 직접 선택
                </button>
                <button
                  type="submit"
                  disabled={isExporting}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  {isExporting ? '저장 중...' : '저장하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="relative max-h-[92vh] max-w-6xl w-full overflow-hidden rounded-lg bg-white shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span>{zoomedImage.label}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-xs font-normal text-slate-500 tabular-nums">
                  {zoomedImage.asset.width} × {zoomedImage.asset.height}px
                </span>
              </div>
              <button
                type="button"
                onClick={() => setZoomedImage(null)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-auto bg-slate-100 p-4">
              <img
                src={zoomedImage.asset.dataUrl}
                alt={zoomedImage.label}
                referrerPolicy="no-referrer"
                className="w-full h-auto object-contain block mx-auto"
              />
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="no-print fixed bottom-5 right-5 z-50">
          <div
            className={`flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium shadow-lg ${
              toast.type === 'error'
                ? 'border-red-200 bg-red-600 text-white'
                : 'border-slate-800 bg-slate-900 text-white'
            }`}
          >
            {toast.type === 'info' && <Check className="h-4 w-4 text-emerald-400 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
