import React, { useCallback, useEffect, useRef, useState } from 'react';
import { learningApi } from '../../api/lpmsApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

type CertificateSettingRow = {
  id: string;
  title: string;
  certificate_signer_name: string | null;
  certificate_signer_title: string | null;
  certificate_signature_file: string | null;
  certificate_signature_file_type: string | null;
  updated_at: string;
};

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
const MAX_FILE_SIZE_MB = 2;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21H4a2 2 0 01-2-2V5a2 2 0 012-2h10l5 5v4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M16 17h2m-1-1v2M9 17v-3a1 1 0 011-1h1a1 1 0 011 1v3M9 17H7m2 0h4" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ── Signature Pad ──────────────────────────────────────────────────────────────
function SignaturePad({
  onSave,
  onCancel,
}: {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasStrokes = useRef(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    drawing.current = true;
    hasStrokes.current = true;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext('2d')!;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e3a5f';
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDraw = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokes.current = false;
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokes.current) return;
    // Export as transparent PNG
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Draw your signature below using mouse or touch:</p>
      <canvas
        ref={canvasRef}
        width={460}
        height={140}
        className="w-full border-2 border-dashed border-slate-300 rounded-lg bg-transparent cursor-crosshair touch-none"
        style={{ background: 'transparent' }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />
      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={clear}
          className="text-xs text-slate-500 hover:text-red-500 underline"
        >
          Clear
        </button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={save}>
            Use This Signature
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export function CertificateCustomizationPage() {
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();

  const [rows, setRows] = useState<CertificateSettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [signatureTab, setSignatureTab] = useState<'upload' | 'draw'>('upload');
  const [viewingSignature, setViewingSignature] = useState<{
    file: string;
    fileType: string;
    title: string;
  } | null>(null);
  const [form, setForm] = useState({
    signerName: '',
    signerTitle: '',
    signatureFile: null as string | null,
    signatureFileType: null as string | null,
    signatureFileName: null as string | null,
  });
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }
      const response = await learningApi.getCertificateSettings(token);
      setRows(response.learningPaths);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load certificate settings.', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, showToast]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const startEdit = (row: CertificateSettingRow) => {
    setEditingId(row.id);
    setSignatureTab('upload');
    setForm({
      signerName: row.certificate_signer_name || '',
      signerTitle: row.certificate_signer_title || '',
      signatureFile: row.certificate_signature_file || null,
      signatureFileType: row.certificate_signature_file_type || null,
      signatureFileName: null,
    });
  };

  const closeEdit = () => {
    setEditingId(null);
    setSignatureTab('upload');
    setForm({ signerName: '', signerTitle: '', signatureFile: null, signatureFileType: null, signatureFileName: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      showToast('Only PNG, JPG, and PDF files are accepted.', 'error');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      showToast(`File must be under ${MAX_FILE_SIZE_MB}MB.`, 'error');
      e.target.value = '';
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      setForm((prev) => ({
        ...prev,
        signatureFile: base64,
        signatureFileType: file.type,
        signatureFileName: file.name,
      }));
    } catch {
      showToast('Failed to read file.', 'error');
    }
  };

  const clearFile = () => {
    setForm((prev) => ({
      ...prev,
      signatureFile: null,
      signatureFileType: null,
      signatureFileName: null,
    }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrawSave = (dataUrl: string) => {
    setForm((prev) => ({
      ...prev,
      signatureFile: dataUrl,
      signatureFileType: 'image/png',
      signatureFileName: 'drawn-signature.png',
    }));
    setSignatureTab('upload'); // switch back to show preview
  };

  const save = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }
      await learningApi.updateCertificateSignature(token, editingId, {
        signerName: form.signerName.trim(),
        signerTitle: form.signerTitle.trim(),
        signatureFile: form.signatureFile,
        signatureFileType: form.signatureFileType,
      });
      showToast('Certificate signature updated.', 'success');
      closeEdit();
      await loadRows();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update signature.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderModalPreview = (file: string | null, fileType: string | null) => {
    if (!file || !fileType) return null;
    if (fileType === 'application/pdf') {
      return (
        <span className="inline-flex items-center gap-1 text-slate-600 text-xs">
          <PdfIcon className="w-5 h-5" />
          PDF Signature
        </span>
      );
    }
    return (
      <img
        src={file}
        alt="Signature preview"
        className="h-20 max-w-[200px] object-contain rounded p-1"
        style={{ background: 'repeating-conic-gradient(#e2e8f0 0% 25%, white 0% 50%) 0 0 / 12px 12px' }}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Certificate Customization</h1>
        <p className="text-slate-500">Set signature name, designation, and signature image/PDF per learning path.</p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 bg-slate-50">
                <th className="py-2 px-3 font-semibold">Learning Path</th>
                <th className="py-2 px-3 font-semibold">Signature Name</th>
                <th className="py-2 px-3 font-semibold">Signature Title</th>
                <th className="py-2 px-3 font-semibold">Signature File</th>
                <th className="py-2 px-3 font-semibold">Updated</th>
                <th className="py-2 px-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="py-3 px-3 text-slate-500" colSpan={6}>Loading...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="py-3 px-3 text-slate-500" colSpan={6}>No learning paths found.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 px-3 font-medium text-slate-900">{row.title}</td>
                    <td className="py-2 px-3">{row.certificate_signer_name || '—'}</td>
                    <td className="py-2 px-3">{row.certificate_signer_title || '—'}</td>
                    <td className="py-2 px-3">
                      {row.certificate_signature_file && row.certificate_signature_file_type ? (
                        <button
                          type="button"
                          onClick={() =>
                            setViewingSignature({
                              file: row.certificate_signature_file!,
                              fileType: row.certificate_signature_file_type!,
                              title: row.title,
                            })
                          }
                          className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          <EyeIcon className="w-4 h-4" />
                          View
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-500">
                      {new Date(row.updated_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-3">
                      <Button size="sm" onClick={() => startEdit(row)}>Edit</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* View Signature Popup */}
      {viewingSignature ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
          onClick={() => setViewingSignature(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Signature File</h2>
                <p className="text-xs text-slate-500 mt-0.5">{viewingSignature.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingSignature(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div
              className="flex items-center justify-center min-h-[160px] rounded-lg border border-slate-200 p-4"
              style={{ background: 'repeating-conic-gradient(#e2e8f0 0% 25%, white 0% 50%) 0 0 / 16px 16px' }}
            >
              {viewingSignature.fileType === 'application/pdf' ? (
                <div className="flex flex-col items-center gap-2 text-slate-500">
                  <PdfIcon className="w-12 h-12 text-red-400" />
                  <p className="text-sm">PDF Signature</p>
                  <p className="text-xs text-slate-400">PDF preview is not available</p>
                </div>
              ) : (
                <img
                  src={viewingSignature.file}
                  alt="Signature"
                  className="max-h-48 max-w-full object-contain"
                />
              )}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setViewingSignature(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Edit Modal */}
      {editingId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <Card className="w-full max-w-lg">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Update Certificate Signature</h2>

              <Input
                label="Signer Name"
                value={form.signerName}
                onChange={(e) => setForm((prev) => ({ ...prev, signerName: e.target.value }))}
                required
              />
              <Input
                label="Signer Title"
                value={form.signerTitle}
                onChange={(e) => setForm((prev) => ({ ...prev, signerTitle: e.target.value }))}
                required
              />

              {/* Signature File Section */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Signature</label>

                {/* Tabs */}
                <div className="flex border border-slate-200 rounded-lg overflow-hidden text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setSignatureTab('upload')}
                    className={`flex-1 py-2 ${signatureTab === 'upload' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignatureTab('draw')}
                    className={`flex-1 py-2 border-l border-slate-200 ${signatureTab === 'draw' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    Draw Signature
                  </button>
                </div>

                {signatureTab === 'upload' ? (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400">PNG with transparent background recommended.</p>

                    {form.signatureFile && (
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
                        {renderModalPreview(form.signatureFile, form.signatureFileType)}
                        <div className="flex-1 min-w-0">
                          {form.signatureFileName && (
                            <p className="text-xs text-slate-600 truncate">{form.signatureFileName}</p>
                          )}
                          <button
                            type="button"
                            onClick={clearFile}
                            className="text-xs text-red-500 hover:text-red-700 mt-1"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.pdf"
                      onChange={handleFileChange}
                      className="block w-full text-sm text-slate-600
                        file:mr-3 file:py-1.5 file:px-3
                        file:rounded file:border file:border-slate-300
                        file:text-sm file:font-medium
                        file:bg-white file:text-slate-700
                        hover:file:bg-slate-50 cursor-pointer"
                    />
                  </div>
                ) : (
                  <SignaturePad
                    onSave={handleDrawSave}
                    onCancel={() => setSignatureTab('upload')}
                  />
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeEdit}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  isLoading={saving}
                  onClick={save}
                  disabled={!form.signerName.trim() || !form.signerTitle.trim()}
                >
                  Save
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}