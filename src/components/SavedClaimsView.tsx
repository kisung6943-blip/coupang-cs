import React, { useMemo, useState } from 'react';
import { Download, FilePlus2, FolderOpen, Search, Trash2 } from 'lucide-react';
import { ClaimFormData, IMAGE_SLOTS } from '../types/claim';

interface SavedClaimsViewProps {
  records: ClaimFormData[];
  currentId: string;
  onLoadClaim: (claim: ClaimFormData) => void;
  onDownloadClaim: (claim: ClaimFormData) => void;
  onDeleteClaim: (id: string) => void;
  onCreateNew: () => void;
}

export const SavedClaimsView: React.FC<SavedClaimsViewProps> = ({
  records,
  currentId,
  onLoadClaim,
  onDownloadClaim,
  onDeleteClaim,
  onCreateNew,
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.orderNumber.toLowerCase().includes(q) ||
        r.reasonText.toLowerCase().includes(q)
    );
  }, [records, query]);

  const formatDateTime = (ts: number) => {
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900">저장된 보상신청 보관함</h1>
          <p className="text-sm text-slate-500 mt-1">
            저장한 양식을 다시 불러와 수정하거나 바로 이미지 파일로 다운로드할 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateNew}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <FilePlus2 className="h-4 w-4" />
          새 양식 작성
        </button>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="성함, 상품명, 보상신청내용으로 검색"
            className="w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
        </div>
        <span className="text-xs font-mono text-slate-500 tabular-nums whitespace-nowrap">
          총 {filtered.length}건
        </span>
      </div>

      {records.length === 0 ? (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white px-6 py-16 text-center">
          <p className="text-base font-semibold text-slate-900">
            아직 보관함에 저장된 보상신청 양식이 없습니다.
          </p>
          <p className="mt-1.5 text-sm text-slate-500">
            작성 화면에서 &lsquo;보관함에 저장&rsquo; 버튼을 누르면 1~5번 입력 내용과 사진이 브라우저에 안전하게 보관됩니다.
          </p>
          <button
            type="button"
            onClick={onCreateNew}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            양식 작성하러 가기
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-700">
            검색어와 일치하는 보관 내역이 없습니다.
          </p>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">성함 / 상품명</th>
                  <th className="py-3 px-4">1번 보상신청내용</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">첨부 사진</th>
                  <th className="py-3 px-4 whitespace-nowrap">저장 일시</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((item) => {
                  const attachedSlots = IMAGE_SLOTS.filter(
                    (s) => item.images[s.key].length > 0
                  ).length;
                  const totalPhotos = IMAGE_SLOTS.reduce(
                    (sum, s) => sum + item.images[s.key].length,
                    0
                  );
                  const isEditing = item.id === currentId;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-semibold text-slate-900">
                          {item.title || '성함 미입력'}
                          {isEditing && (
                            <span className="ml-2 text-xs font-medium text-blue-600">
                              현재 편집중
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {item.orderNumber ? `상품명: ${item.orderNumber}` : '상품명 미입력'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 align-top max-w-xs">
                        <p className="line-clamp-2 text-xs text-slate-600 whitespace-pre-line">
                          {item.reasonText || '(내용 미입력)'}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 align-top text-right font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        {totalPhotos > attachedSlots
                          ? `${attachedSlots} / 4 (${totalPhotos}장)`
                          : `${attachedSlots} / 4`}
                      </td>
                      <td className="py-3.5 px-4 align-top font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                        {formatDateTime(item.updatedAt)}
                      </td>
                      <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onLoadClaim(item)}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            불러오기
                          </button>
                          <button
                            type="button"
                            onClick={() => onDownloadClaim(item)}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5" />
                            JPG
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteClaim(item.id)}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
                            title="보관함에서 삭제"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            삭제
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
      )}
    </div>
  );
};
