import React, { useRef, useState } from 'react';
import {
  ClipboardPaste,
  FolderOpen,
  ImagePlus,
  Maximize2,
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
  asset: ImageAsset | null;
  isActive: boolean;
  onFocusSlot: () => void;
  onChange: (asset: ImageAsset | null) => void;
  onPreviewZoom: (asset: ImageAsset, label: string) => void;
  onNotify: (message: string, type?: 'info' | 'error') => void;
}

export const ImageSlotCard: React.FC<ImageSlotCardProps> = ({
  slot,
  asset,
  isActive,
  onFocusSlot,
  onChange,
  onPreviewZoom,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [previewScale, setPreviewScale] = useState<number>(100);

  const handleFile = async (file: File) => {
    setIsBusy(true);
    try {
      const nextAsset = await readImageFileAsAsset(file);
      setPreviewScale(100);
      onChange(nextAsset);
      onNotify(`${slot.stepNumber}번 ${slot.headerLabel} 사진이 등록되었습니다.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '이미지 등록에 실패했습니다.';
      onNotify(msg, 'error');
    } finally {
      setIsBusy(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    onFocusSlot();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const handlePasteEvent = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          void handleFile(file);
          return;
        }
      }
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
      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const ext = imageType.split('/')[1] || 'png';
          const file = new File([blob], `${slot.key}_paste.${ext}`, { type: imageType });
          await handleFile(file);
          return;
        }
      }
      onNotify('클립보드에 복사된 이미지가 없습니다. 스크린샷을 먼저 복사해 주세요.', 'error');
    } catch {
      onNotify('브라우저 권한으로 직접 읽기가 제한되었습니다. 영역을 클릭 후 Ctrl+V를 눌러주세요.', 'info');
    }
  };

  const handleRotate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!asset || isBusy) return;
    setIsBusy(true);
    try {
      const rotated = await rotateImageAsset(asset);
      onChange(rotated);
    } catch {
      onNotify('이미지 회전에 실패했습니다.', 'error');
    } finally {
      setIsBusy(false);
    }
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
              {asset && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 font-mono tabular-nums whitespace-nowrap">
                  {asset.width} × {asset.height}px
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
            title="컴퓨터에서 이미지 파일 선택"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {asset ? '파일 교체' : '파일 선택'}
          </button>

          <button
            type="button"
            onClick={handleClipboardButton}
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50/70 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="클립보드에서 이미지 붙여넣기"
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            붙여넣기
          </button>

          {asset && (
            <>
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

              <button
                type="button"
                onClick={handleRotate}
                disabled={isBusy}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                title="시계방향 90도 회전"
              >
                <RotateCw className="h-3.5 w-3.5" />
                회전
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                  onNotify(`${slot.stepNumber}번 ${slot.headerLabel} 사진이 삭제되었습니다.`);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="사진 삭제"
              >
                <Trash2 className="h-3.5 w-3.5" />
                삭제
              </button>
            </>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />

      {asset ? (
        <div className="mt-4">
          <div className="group relative overflow-auto rounded-md border border-slate-200 bg-slate-50">
            <img
              src={asset.dataUrl}
              alt={`${slot.stepNumber}번 ${slot.headerLabel} 첨부 이미지`}
              referrerPolicy="no-referrer"
              onClick={(e) => {
                e.stopPropagation();
                onPreviewZoom(asset, `${slot.stepNumber}. ${slot.headerLabel}`);
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
                onPreviewZoom(asset, `${slot.stepNumber}. ${slot.headerLabel}`);
              }}
              className="sticky right-2.5 bottom-2.5 float-right m-2.5 inline-flex items-center gap-1 rounded-md bg-slate-900/85 px-3 py-1.5 text-xs font-medium text-white opacity-95 hover:opacity-100 transition-opacity cursor-pointer shadow-sm"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              전체화면 크게 보기
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span className="truncate max-w-[320px] font-medium text-slate-600">{asset.fileName}</span>
            <span>상단 돋보기(+)로 화면 내 확대 가능 · 이미지 클릭 시 전체화면 · Ctrl+V 즉시 교체</span>
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
            {slot.hint}
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
