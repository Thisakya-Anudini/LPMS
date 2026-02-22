import React, { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { employeeApi } from '../../api/lpmsApi';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/useAuth';

type CertificateRow = {
  id: string;
  scope: 'STAGE' | 'FULL';
  issued_at: string;
  learning_path_id: string;
  learning_path_title: string;
};

export function MyLearningPaths() {
  const { getAccessToken } = useAuth();
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const token = await getAccessToken();
        if (!token) {
          setError('Session expired. Please login again.');
          return;
        }
        const response = await employeeApi.getCertificates(token);
        setCertificates(response.certificates);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load certificate history.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [getAccessToken]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Learning History</h1>
        <p className="text-slate-500">View certificates issued for your completed learning paths.</p>
      </div>

      {error ? <Card className="text-red-600">{error}</Card> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <Card>Loading certificates...</Card>
        ) : certificates.length === 0 ? (
          <Card>No certificates issued yet.</Card>
        ) : (
          certificates.map((certificate) => (
            <Card key={certificate.id} className="border-green-200 bg-green-50/30">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <Badge variant="success" className="mb-2">
                    {certificate.scope === 'FULL' ? 'Full Completion' : 'Stage Completion'}
                  </Badge>
                  <h3 className="text-lg font-bold text-slate-900">{certificate.learning_path_title}</h3>
                  <p className="text-sm text-slate-500">
                    Issued on {new Date(certificate.issued_at).toLocaleDateString()}
                  </p>
                </div>
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
