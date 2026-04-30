import React, { useCallback, useEffect, useRef, useState } from 'react';
import { learningApi } from '../../api/lpmsApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { ModalOverlay } from '../../components/ui/ModalOverlay';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

type CertificateSettingRow = {
  id: string;
  title: string;
  certificate_signer_name: string | null;
  certificate_signer_title: string | null;
  certificate_signature_png: string | null;
  updated_at: string;
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read signature file.'));
    reader.readAsDataURL(file);
  });

export function CertificateCustomizationPage() {
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();

  const [rows, setRows] = useState<CertificateSettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ signerName: '', signerTitle: '', signaturePngDataUrl: '' });
  const [saving, setSaving] = useState(false);
  const [previewState, setPreviewState] = useState<{
    title: string;
    url: string | null;
    loading: boolean;
    error: string | null;
  } | null>(null);
  const previewUrlRef = useRef<string | null>(null);

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

  const revokePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  useEffect(() => () => revokePreviewUrl(), [revokePreviewUrl]);

  const startEdit = (row: CertificateSettingRow) => {
    setEditingId(row.id);
    setForm({
      signerName: row.certificate_signer_name || '',
      signerTitle: row.certificate_signer_title || '',
      signaturePngDataUrl: row.certificate_signature_png || ''
    });
  };

  const closeEdit = () => {
    setEditingId(null);
    setForm({ signerName: '', signerTitle: '', signaturePngDataUrl: '' });
  };

  const closePreview = useCallback(() => {
    revokePreviewUrl();
    setPreviewState(null);
  }, [revokePreviewUrl]);

  const openPreview = useCallback(
    async (
      learningPathId: string,
      title: string,
      payload?: { signerName?: string; signerTitle?: string; signaturePngDataUrl?: string | null }
    ) => {
      revokePreviewUrl();
      setPreviewState({ title, url: null, loading: true, error: null });

      try {
        const token = await getAccessToken();
        if (!token) {
          setPreviewState({
            title,
            url: null,
            loading: false,
            error: 'Session expired. Please login again.'
          });
          return;
        }

        const blob = await learningApi.previewCertificate(token, learningPathId, payload);
        const previewUrl = URL.createObjectURL(blob);
        previewUrlRef.current = previewUrl;
        setPreviewState({ title, url: previewUrl, loading: false, error: null });
      } catch (err) {
        setPreviewState({
          title,
          url: null,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load certificate preview.'
        });
      }
    },
    [getAccessToken, revokePreviewUrl]
  );

  const handleSignatureFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (file.type !== 'image/png') {
      showToast('Please upload a PNG signature image.', 'error');
      event.target.value = '';
      return;
    }

    try {
      const signaturePngDataUrl = await readFileAsDataUrl(file);
      setForm((prev) => ({ ...prev, signaturePngDataUrl }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to read signature image.', 'error');
    } finally {
      event.target.value = '';
    }
  };

  const save = async () => {
    if (!editingId) {
      return;
    }
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
        signaturePngDataUrl: form.signaturePngDataUrl || null
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Certificate Customization</h1>
        <p className="text-slate-500">Set signature name and designation per learning path.</p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 bg-slate-50">
                <th className="py-2 px-3 font-semibold">Learning Path</th>
                <th className="py-2 px-3 font-semibold">Signature Name</th>
                <th className="py-2 px-3 font-semibold">Signature Title</th>
                <th className="py-2 px-3 font-semibold">PNG Signature</th>
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
                    <td className="py-2 px-3">{row.certificate_signer_name || '-'}</td>
                    <td className="py-2 px-3">{row.certificate_signer_title || '-'}</td>
                    <td className="py-2 px-3">{row.certificate_signature_png ? 'Uploaded' : '-'}</td>
                    <td className="py-2 px-3 text-slate-500">
                      {new Date(row.updated_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPreview(row.id, row.title)}
                        >
                          Preview
                        </Button>
                        <Button size="sm" onClick={() => startEdit(row)}>Edit</Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {editingId ? (
        <ModalOverlay className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4">
          <Card className="w-full max-w-lg">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Update Certificate Signature</h2>
              <Input
                label="Signer Name"
                value={form.signerName}
                onChange={(event) => setForm((prev) => ({ ...prev, signerName: event.target.value }))}
                required
              />
              <Input
                label="Signer Title"
                value={form.signerTitle}
                onChange={(event) => setForm((prev) => ({ ...prev, signerTitle: event.target.value }))}
                required
              />
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Signature PNG</label>
                <input
                  type="file"
                  accept="image/png"
                  onChange={handleSignatureFileChange}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                />
                <p className="text-xs text-slate-500">Upload a PNG signature image for this learning path certificate.</p>
                {form.signaturePngDataUrl ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <img
                      src={form.signaturePngDataUrl}
                      alt="Signature preview"
                      className="max-h-24 w-auto object-contain"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No PNG signature uploaded yet.</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    openPreview(
                      editingId,
                      rows.find((row) => row.id === editingId)?.title || 'Learning Path Certificate',
                      {
                        signerName: form.signerName.trim(),
                        signerTitle: form.signerTitle.trim(),
                        signaturePngDataUrl: form.signaturePngDataUrl || null
                      }
                    )
                  }
                >
                  Preview Certificate
                </Button>
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
        </ModalOverlay>
      ) : null}

      {previewState ? (
        <ModalOverlay className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <Card className="max-h-full w-full max-w-6xl overflow-y-auto">
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Certificate Preview</h2>
                  <p className="text-sm text-slate-500">
                    This preview is generated from the exact same PDF template used in learner downloads for{' '}
                    <span className="font-medium text-slate-700">{previewState.title}</span>.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={closePreview}>
                  Close
                </Button>
              </div>

              {previewState.loading ? (
                <div className="flex h-[70vh] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500">
                  Generating certificate preview...
                </div>
              ) : previewState.error ? (
                <div className="flex h-[70vh] items-center justify-center rounded-lg border border-red-200 bg-red-50 px-6 text-sm text-red-600">
                  {previewState.error}
                </div>
              ) : previewState.url ? (
                <iframe
                  src={previewState.url}
                  title={`Certificate preview for ${previewState.title}`}
                  className="h-[70vh] w-full rounded-lg border border-slate-200"
                />
              ) : null}
            </div>
          </Card>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
