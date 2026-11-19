import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ClipboardPaste,
  FolderOpen,
  ImagePlus,
  Maximize2,
  Plus,
  RefreshCw,
  RotateCw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { ImageAsset, SlotDefinition } from '../types/claim';
import { readImageFileAsAsset, rotateImageAsset } from '../utils/canvasExporter';

interface ImageSlotCardProps {
  slot: SlotDefinition;
  assets: ImageAsset[];
  isActive: boolean;
  onFocusSlot: () => void;
  onChange: (updater: ImageAsset[] | ((prev: ImageAsset[]) => ImageAsset[])) => void;
  onPreviewZoom: (asset: ImageAsset, label: string) => void;
  onNotify: (message: string, type?: 'info' | 'error') => void;
}

export const ImageSlotCard: React.FC<ImageSlotCardProps> = ({
  slot,
  assets,
  isActive,
  onFocusSlot,
  onChange,
  onPreviewZoom,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceIndexRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [previewScale, setPreviewScale] = useState<number>(100);

  const handleAddFiles = async (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      onNotify('이미지 파일(JPG, PNG, WEBP 등)만 업로드할 수 있습니다.', 'error');
      return;
    }

    setIsBusy(true);
    try {
      const nextAssets: ImageAsset[] = [];
      for (const file of imageFiles) {
        const asset = await readImageFileAsAsset(file);
        nextAssets.push(asset);
      }

      onChange((prev) => [...prev, ...nextAssets]);
      if (nextAssets.length === 1) {
        const totalAfter = assets.length + 1;
        onNotify(
          totalAfter > 1
            ? `${slot.stepNumber}번 ${slot.headerLabel} 사진이 추가되었습니다. (${totalAfter}번째)`
            : `${slot.stepNumber}번 ${slot.headerLabel} 사진이 등록되었습니다.`
        );
      } else {
        onNotify(
          `${slot.stepNumber}번 ${slot.headerLabel} 사진 ${nextAssets.length}장이 순서대로 추가되었습니다.`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '이미지 등록에 실패했습니다.';
      onNotify(msg, 'error');
    } finally {
      setIsBusy(false);
    }
  };

  const handleReplaceFile = async (file: File, index: number) => {
    setIsBusy(true);
    try {
      const replaced = await readImageFileAsAsset(file);
      onChange((prev) => prev.map((item, idx) => (idx === index ? replaced : item)));
      onNotify(`${slot.stepNumber}번 ${slot.headerLabel} ${index + 1}번째 사진이 교체되었습니다.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '이미지 교체에 실패했습니다.';
      onNotify(msg, 'error');
    } finally {
      setIsBusy(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      void handleAddFiles(files);
    }
    e.target.value = '';
  };

  const handleReplaceInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetIndex = replaceIndexRef.current;
    replaceIndexRef.current = null;
    if (file && targetIndex !== null) {
      void handleReplaceFile(file, targetIndex);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    onFocusSlot();
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    if (files.length > 0) {
      void handleAddFiles(files);
    }
  };

  const handlePasteEvent = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      void handleAddFiles(files);
    }
  };

  const handleClipboardButton = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onFocusSlot();
    if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
      onNotify('이 영역을 클릭한 뒤 Ctrl+V(맥은 Cmd+V)로 이미지를 붙여넣어 주세요.', 'info');
      return;
    }
    try {
      const clipboardItems = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const ext = imageType.split('/')[1] || 'png';
          files.push(
            new File([blob], `${slot.key}_paste_${Date.now()}.${ext}`, { type: imageType })
          );
        }
      }
      if (files.length > 0) {
        await handleAddFiles(files);
        return;
      }
      onNotify('클립보드에 복사된 이미지가 없습니다. 스크린샷을 먼저 복사해 주세요.', 'error');
    } catch {
      onNotify('브라우저 권한으로 직접 읽기가 제한되었습니다. 영역을 클릭 후 Ctrl+V를 눌러주세요.', 'info');
    }
  };

  const handleRotateAt = async (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const target = assets[index];
    if (!target || isBusy) return;
    setIsBusy(true);
    try {
      const rotated = await rotateImageAsset(target);
      onChange((prev) => prev.map((item, idx) => (idx === index ? rotated : item)));
    } catch {
      onNotify('이미지 회전에 실패했습니다.', 'error');
    } finally {
      setIsBusy(false);
    }
  };

  const handleMove = (e: React.MouseEvent, index: number, direction: -1 | 1) => {
    e.stopPropagation();
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= assets.length) return;
    onChange((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, moved);
      return copy;
    });
  };

  const handleDeleteAt = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    onChange((prev) => prev.filter((_, idx) => idx !== index));
    onNotify(
      assets.length > 1
        ? `${slot.stepNumber}번 ${slot.headerLabel} ${index + 1}번째 사진이 삭제되었습니다.`
        : `${slot.stepNumber}번 ${slot.headerLabel} 사진이 삭제되었습니다.`
    );
  };

  return (
    <section
      id={`slot-${slot.key}`}
      tabIndex={0}
      onFocus={onFocusSlot}
      onClick={onFocusSlot}
      onPaste={handlePasteEvent}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`rounded-lg border bg-white p-5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
        isDragging
          ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/30'
          : isActive
            ? 'border-blue-500 ring-2 ring-blue-500/15'
            : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded bg-slate-900 font-mono text-xs font-semibold text-white tabular-nums">
            {slot.stepNumber}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 truncate">
                {slot.headerLabel}
              </h3>
              <span className="text-xs text-slate-500 hidden sm:inline">
                {slot.description}
              </span>
              {assets.length > 0 && (
                <span className="rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-xs text-blue-700 font-semibold tabular-nums whitespace-nowrap">
                  {assets.length}장
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFocusSlot();
              fileInputRef.current?.click();
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="컴퓨터에서 이미지 파일 선택 (여러 장 선택 가능)"
          >
            {assets.length > 0 ? (
              <Plus className="h-3.5 w-3.5" />
            ) : (
              <FolderOpen className="h-3.5 w-3.5" />
            )}
            {assets.length > 0 ? '사진 추가' : '파일 선택'}
          </button>

          <button
            type="button"
            onClick={handleClipboardButton}
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50/70 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="클립보드에서 이미지 붙여넣기"
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            {assets.length > 0 ? '붙여넣기 추가' : '붙여넣기'}
          </button>

          {assets.length > 0 && (
            <div className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewScale((prev) => Math.max(100, prev - 25));
                }}
                disabled={previewScale <= 100}
                className="rounded px-1.5 py-1 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-40 cursor-pointer"
                title="축소"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewScale(100);
                }}
                className="px-1.5 text-xs font-mono font-semibold text-slate-700 cursor-pointer"
                title="가로폭 맞춤 (100%)"
              >
                {previewScale}%
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewScale((prev) => Math.min(250, prev + 25));
                }}
                disabled={previewScale >= 250}
                className="rounded px-1.5 py-1 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-40 cursor-pointer"
                title="글자 크게 보기 (확대)"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleInputChange}
        className="hidden"
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        onChange={handleReplaceInputChange}
        className="hidden"
      />

      {assets.length > 0 ? (
        <div className="mt-4 space-y-4">
          {assets.map((asset, index) => (
            <div
              key={`${asset.updatedAt}_${index}`}
              className="rounded-md border border-slate-200 bg-slate-50/50 overflow-hidden"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex items-center justify-center rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white tabular-nums shrink-0">
                    {index + 1}번 사진
                  </span>
                  <span className="truncate max-w-[260px] text-xs font-medium text-slate-600">
                    {asset.fileName}
                  </span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500 font-mono tabular-nums whitespace-nowrap shrink-0">
                    {asset.width} × {asset.height}px
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1 shrink-0">
                  {assets.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => handleMove(e, index, -1)}
                        disabled={index === 0 || isBusy}
                        className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-35 cursor-pointer"
                        title="순서 위로 이동"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleMove(e, index, 1)}
                        disabled={index === assets.length - 1 || isBusy}
                        className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-35 cursor-pointer"
                        title="순서 아래로 이동"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFocusSlot();
                      replaceIndexRef.current = index;
                      replaceInputRef.current?.click();
                    }}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                    title="이 사진 교체"
                  >
                    <RefreshCw className="h-3 w-3" />
                    교체
                  </button>
                  <button
                    type="button"
                    onClick={(e) => void handleRotateAt(e, index)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                    title="시계방향 90도 회전"
                  >
                    <RotateCw className="h-3 w-3" />
                    회전
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteAt(e, index)}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors whitespace-nowrap cursor-pointer"
                    title="이 사진 삭제"
                  >
                    <Trash2 className="h-3 w-3" />
                    삭제
                  </button>
                </div>
              </div>

              <div className="group relative overflow-auto bg-slate-50">
                <img
                  src={asset.dataUrl}
                  alt={`${slot.stepNumber}번 ${slot.headerLabel} ${index + 1}번째 첨부 이미지`}
                  referrerPolicy="no-referrer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreviewZoom(
                      asset,
                      assets.length > 1
                        ? `${slot.stepNumber}. ${slot.headerLabel} (${index + 1}번 사진)`
                        : `${slot.stepNumber}. ${slot.headerLabel}`
                    );
                  }}
                  style={{
                    width: `${previewScale}%`,
                    maxWidth: previewScale > 100 ? 'none' : '100%',
                  }}
                  className="h-auto object-contain block cursor-zoom-in mx-auto"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreviewZoom(
                      asset,
                      assets.length > 1
                        ? `${slot.stepNumber}. ${slot.headerLabel} (${index + 1}번 사진)`
                        : `${slot.stepNumber}. ${slot.headerLabel}`
                    );
                  }}
                  className="sticky right-2.5 bottom-2.5 float-right m-2.5 inline-flex items-center gap-1 rounded-md bg-slate-900/85 px-3 py-1.5 text-xs font-medium text-white opacity-95 hover:opacity-100 transition-opacity cursor-pointer shadow-sm"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  전체화면 크게 보기
                </button>
              </div>
            </div>
          ))}

          {/* Add another photo bar */}
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onFocusSlot();
              fileInputRef.current?.click();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50/70 px-4 py-3 text-xs text-slate-600 hover:border-blue-400 hover:bg-blue-50/30 transition-colors cursor-pointer"
          >
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <Plus className="h-4 w-4 text-blue-600" />
              사진 추가 ({assets.length + 1}번째 사진으로 순서대로 추가 · 드래그 또는 Ctrl+V 가능)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFocusSlot();
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                파일 선택
              </button>
              <button
                type="button"
                onClick={handleClipboardButton}
                className="inline-flex items-center gap-1 rounded border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 cursor-pointer"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                붙여넣기
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onFocusSlot();
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`mt-4 min-h-[240px] flex flex-col items-center justify-center rounded-md border-2 border-dashed px-6 py-12 text-center transition-colors cursor-pointer ${
            isActive
              ? 'border-blue-400 bg-blue-50/30'
              : 'border-slate-300 bg-slate-50/70 hover:border-slate-400 hover:bg-slate-100/70'
          }`}
        >
          <ImagePlus className={`h-9 w-9 mb-3 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
          <p className="text-base font-semibold text-slate-800">
            {isBusy
              ? '이미지 불러오는 중...'
              : `${slot.stepNumber}번 ${slot.headerLabel} 사진을 여기에 놓거나 붙여넣으세요`}
          </p>
          <p className="mt-1.5 text-sm text-slate-600">
            {slot.description}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {slot.hint} · 여러 장을 순서대로 추가할 수 있습니다.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFocusSlot();
                fileInputRef.current?.click();
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              컴퓨터에서 사진 선택
            </button>
            <button
              type="button"
              onClick={handleClipboardButton}
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              클립보드 붙여넣기 (Ctrl+V)
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
