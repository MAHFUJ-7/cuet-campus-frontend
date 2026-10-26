// Send Feedback — port of feedback_screen.dart.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Icon,
  PageHeader,
  PageShell,
  Spinner,
  TextField,
} from '../../components/ui/index.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { describeApiError } from '../../api/errors.js';
import { submitFeedback } from '../../api/endpoints.js';

const TYPES = [
  { value: 'bug', label: 'Bug Report' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'improvement', label: 'Improvement' },
  { value: 'other', label: 'Other' },
];

export default function FeedbackPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [type, setType] = useState('bug');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const next = {};
    if (!subject.trim()) next.subject = 'Please enter a subject';
    if (!description.trim()) next.description = 'Please enter a description';
    else if (description.trim().length < 10)
      next.description = 'Description must be at least 10 characters';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setIsLoading(true);
    try {
      await submitFeedback({
        type,
        subject: subject.trim(),
        description: description.trim(),
      });
      toast.success('Thank you for your feedback!');
      navigate(-1);
    } catch (error) {
      toast.error(`Error: ${describeApiError(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageShell className="max-w-xl">
      <PageHeader title="Send Feedback" onBack={() => navigate(-1)} />

      <div className="mb-5 flex items-start gap-3 rounded-xl bg-primary/10 p-4">
        <Icon name="info" size={20} className="shrink-0 text-primary dark:text-primary-light" />
        <p className="text-body-md text-primary dark:text-primary-light">
          Your feedback helps us improve the app. Please be as specific as possible.
        </p>
      </div>

      <Card className="space-y-4">
        <div>
          <label htmlFor="feedback-type" className="mb-1.5 block text-label-lg font-medium text-ink-muted">
            Feedback Type
          </label>
          <select
            id="feedback-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-xl border border-outline bg-surface px-3.5 py-3 text-body-md text-ink focus:border-primary focus:outline-none"
          >
            {TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <TextField
          label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          hint="Short summary"
          error={errors.subject}
        />

        <TextField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          hint="What happened? What did you expect?"
          multiline
          rows={5}
          error={errors.description}
        />

        <Button variant="filled" className="w-full" disabled={isLoading} onClick={submit}>
          {isLoading ? <Spinner size={18} /> : 'Submit Feedback'}
        </Button>
      </Card>
    </PageShell>
  );
}
