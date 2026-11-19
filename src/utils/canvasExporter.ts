import {
  ClaimFormData,
  IMAGE_SLOTS,
  ImageAsset,
  normalizeSlotImages,
} from '../types/claim';

export type ExportImageFormat = 'image/jpeg' | 'image/png';

interface LoadedImage {
  element: HTMLImageElement;
  asset: ImageAsset;
  drawWidth: number;
  drawHeight: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 불러오는 중 오류가 발생했습니다.'));
    img.src = src;
  });
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const rawLines = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const rawLine of rawLines) {
    if (rawLine.trim() === '') {
      lines.push('');
      continue;
    }

    let currentLine = '';
    for (const char of rawLine) {
      const testLine = currentLine + char;
      if (ctx.measureText(testLine).width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
  }

  return lines.length > 0 ? lines : [''];
}

function getRotatedDimensions(
  asset: ImageAsset,
  maxContentWidth: number
): { drawWidth: number; drawHeight: number } {
  const isQuarterTurn = asset.rotation === 90 || asset.rotation === 270;
  const naturalW = isQuarterTurn ? asset.height : asset.width;
  const naturalH = isQuarterTurn ? asset.width : asset.height;

  const safeW = Math.max(naturalW, 1);
  const safeH = Math.max(naturalH, 1);

  // Fit all slot images (2~5번) to the full content width so text/details are clearly legible
  const scale = maxContentWidth / safeW;
  return {
    drawWidth: Math.round(safeW * scale),
    drawHeight: Math.round(safeH * scale),
  };
}

function drawRotatedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  rotation: 0 | 90 | 180 | 270,
  x: number,
  y: number,
  drawWidth: number,
  drawHeight: number
) {
  ctx.save();
  const cx = x + drawWidth / 2;
  const cy = y + drawHeight / 2;
  ctx.translate(cx, cy);
  ctx.rotate((rotation * Math.PI) / 180);

  if (rotation === 90 || rotation === 270) {
    ctx.drawImage(img, -drawHeight / 2, -drawWidth / 2, drawHeight, drawWidth);
  } else {
    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  }
  ctx.restore();
}

export async function renderClaimCanvas(
  claim: ClaimFormData,
  options: { includeEmptySections?: boolean } = {}
): Promise<HTMLCanvasElement> {
  const includeEmpty = options.includeEmptySections ?? false;
  const sheetWidth = 1400;
  const paddingX = 48;
  const paddingY = 48;
  const contentWidth = sheetWidth - paddingX * 2;

  const headerFont = '700 36px "Noto Sans KR", "Apple SD Gothic Neo", sans-serif';
  const bodyFont = '500 28px "Noto Sans KR", "Apple SD Gothic Neo", sans-serif';
  const placeholderFont = '400 20px "Noto Sans KR", "Apple SD Gothic Neo", sans-serif';

  const headerPadX = 16;
  const headerPadY = 10;
  const headerHeight = 54;
  const headerToContentGap = 22;
  const imageStackGap = 20;
  const sectionGap = 40;
  const lineHeight = 42;

  // Measure canvas context
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) {
    throw new Error('캔버스 컨텍스트를 생성할 수 없습니다.');
  }

  measureCtx.font = bodyFont;
  const reasonContent = claim.reasonText.trim() || '보상신청내용을 입력해주세요.';
  const reasonLines = wrapTextLines(measureCtx, reasonContent, contentWidth - 8);
  const reasonBlockHeight = reasonLines.length * lineHeight;

  // Preload all present images in order
  const loadedImages: Record<string, LoadedImage[]> = {};
  for (const slot of IMAGE_SLOTS) {
    const assets = normalizeSlotImages(claim.images[slot.key]);
    const list: LoadedImage[] = [];
    for (const asset of assets) {
      if (asset?.dataUrl) {
        const element = await loadImage(asset.dataUrl);
        const dims = getRotatedDimensions(asset, contentWidth);
        list.push({
          element,
          asset,
          drawWidth: dims.drawWidth,
          drawHeight: dims.drawHeight,
        });
      }
    }
    loadedImages[slot.key] = list;
  }

  // Compute total height
  let totalHeight = paddingY;
  // Section 1: 보상신청내용
  totalHeight += headerHeight + headerToContentGap + reasonBlockHeight + sectionGap;

  for (const slot of IMAGE_SLOTS) {
    const loadedList = loadedImages[slot.key] ?? [];
    if (loadedList.length === 0 && !includeEmpty) {
      continue;
    }
    totalHeight += headerHeight + headerToContentGap;
    if (loadedList.length > 0) {
      for (let i = 0; i < loadedList.length; i++) {
        totalHeight += loadedList[i].drawHeight;
        if (i < loadedList.length - 1) {
          totalHeight += imageStackGap;
        }
      }
    } else {
      totalHeight += 88;
    }
    totalHeight += sectionGap;
  }

  totalHeight = totalHeight - sectionGap + paddingY;

  const canvas = document.createElement('canvas');
  canvas.width = sheetWidth;
  canvas.height = Math.max(totalHeight, 400);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('캔버스 컨텍스트를 생성할 수 없습니다.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Crisp white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const drawSectionHeader = (label: string, y: number) => {
    ctx.font = headerFont;
    const textMetrics = ctx.measureText(label);
    const boxWidth = Math.ceil(textMetrics.width) + headerPadX * 2;
    ctx.fillStyle = '#000000';
    ctx.fillRect(paddingX, y, boxWidth, headerHeight);

    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, paddingX + headerPadX, y + headerHeight / 2 + 1);
  };

  let cursorY = paddingY;

  // Section 1: 보상신청내용
  drawSectionHeader('보상신청내용', cursorY);
  cursorY += headerHeight + headerToContentGap;

  ctx.font = bodyFont;
  ctx.fillStyle = claim.reasonText.trim() ? '#111111' : '#94A3B8';
  ctx.textBaseline = 'top';
  for (let i = 0; i < reasonLines.length; i++) {
    ctx.fillText(reasonLines[i], paddingX + 4, cursorY + i * lineHeight);
  }
  cursorY += reasonBlockHeight + sectionGap;

  // Sections 2~5: Images (in sequential order)
  for (const slot of IMAGE_SLOTS) {
    const loadedList = loadedImages[slot.key] ?? [];
    if (loadedList.length === 0 && !includeEmpty) {
      continue;
    }

    drawSectionHeader(slot.headerLabel, cursorY);
    cursorY += headerHeight + headerToContentGap;

    if (loadedList.length > 0) {
      for (let i = 0; i < loadedList.length; i++) {
        const loaded = loadedList[i];
        const offsetX = paddingX + Math.round((contentWidth - loaded.drawWidth) / 2);
        drawRotatedImage(
          ctx,
          loaded.element,
          loaded.asset.rotation,
          offsetX,
          cursorY,
          loaded.drawWidth,
          loaded.drawHeight
        );
        cursorY += loaded.drawHeight;
        if (i < loadedList.length - 1) {
          cursorY += imageStackGap;
        }
      }
      cursorY += sectionGap;
    } else {
      ctx.save();
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(paddingX, cursorY, contentWidth, 88);
      ctx.setLineDash([]);
      ctx.font = placeholderFont;
      ctx.fillStyle = '#64748B';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(`${slot.headerLabel} 사진 미첨부`, paddingX + contentWidth / 2, cursorY + 44);
      ctx.restore();
      cursorY += 88 + sectionGap;
    }
  }

  return canvas;
}

export function getTodayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatKoreanDate(dateStr?: string): string {
  const raw = (dateStr || '').trim() || getTodayDateString();
  const match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return `${yyyy}년 ${mm.padStart(2, '0')}월 ${dd.padStart(2, '0')}일`;
  }
  return raw;
}

export function getDefaultFileNameBase(claim: ClaimFormData): string {
  const datePart = formatKoreanDate(claim.claimDate);
  const namePart = claim.title.trim();
  const productPart = claim.orderNumber.trim();
  const rawBase = [datePart, namePart, productPart].filter(Boolean).join('_');
  return rawBase.replace(/[\\/:*?"<>|]/g, '_').trim();
}

export function sanitizeFileName(rawName: string, ext = 'jpg'): string {
  const trimmed = rawName.trim().replace(/\.(jpg|jpeg|png)$/i, '');
  const safe =
    trimmed.replace(/[\\/:*?"<>|]/g, '_').trim() ||
    formatKoreanDate();
  return `${safe}.${ext}`;
}

export async function exportClaimAsImage(
  claim: ClaimFormData,
  format: ExportImageFormat = 'image/jpeg',
  includeEmptySections = false,
  customFileName?: string
): Promise<{ blob: Blob; fileName: string }> {
  const canvas = await renderClaimCanvas(claim, { includeEmptySections });
  const ext = format === 'image/png' ? 'png' : 'jpg';
  const baseName = customFileName?.trim()
    ? customFileName.trim()
    : getDefaultFileNameBase(claim);
  const fileName = sanitizeFileName(baseName, ext);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('이미지 변환에 실패했습니다.'));
      },
      format,
      format === 'image/jpeg' ? 0.94 : undefined
    );
  });

  return { blob, fileName };
}

export function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function saveBlobWithPicker(
  blob: Blob,
  fileName: string
): Promise<boolean> {
  const win = window as Window & {
    showSaveFilePicker?: (options?: unknown) => Promise<{
      createWritable: () => Promise<{
        write: (data: Blob) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  };

  if (typeof win.showSaveFilePicker === 'function') {
    const handle = await win.showSaveFilePicker({
      suggestedName: fileName,
      types: [
        {
          description: 'JPEG 이미지',
          accept: { 'image/jpeg': ['.jpg', '.jpeg'] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  }

  triggerBlobDownload(blob, fileName);
  return true;
}

export function readImageFileAsAsset(file: File): Promise<ImageAsset> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('이미지 파일(JPG, PNG, WEBP 등)만 업로드할 수 있습니다.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        reject(new Error('파일을 읽지 못했습니다.'));
        return;
      }
      try {
        const img = await loadImage(dataUrl);
        resolve({
          dataUrl,
          fileName: file.name || `image_${Date.now()}.png`,
          width: img.naturalWidth,
          height: img.naturalHeight,
          rotation: 0,
          updatedAt: Date.now(),
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('파일을 읽는 중 오류가 발생했습니다.'));
    reader.readAsDataURL(file);
  });
}

export async function rotateImageAsset(asset: ImageAsset): Promise<ImageAsset> {
  const img = await loadImage(asset.dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalHeight;
  canvas.height = img.naturalWidth;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('이미지를 회전할 수 없습니다.');
  }

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

  const isPng = asset.dataUrl.startsWith('data:image/png');
  const rotatedDataUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.95);

  return {
    ...asset,
    dataUrl: rotatedDataUrl,
    width: canvas.width,
    height: canvas.height,
    rotation: 0,
    updatedAt: Date.now(),
  };
}

