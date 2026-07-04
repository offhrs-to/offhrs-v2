import { useCallback, useRef, useState } from 'react';

import StrictCancellationAckModal from '@/components/StrictCancellationAckModal';
import { fetchRefundPolicyForEvent } from '@/lib/booking-cancel';
import type { ConsumerRefundPolicyDisplay } from '@/lib/vendor-refund-policy';

type UseStrictBookingAckOptions = {
  /** Use when booking from inside another RN Modal (e.g. workshop quick view). */
  embedded?: boolean;
};

export function useStrictBookingAck(options?: UseStrictBookingAckOptions) {
  const [visible, setVisible] = useState(false);
  const [policy, setPolicy] = useState<ConsumerRefundPolicyDisplay | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const resolvePending = useCallback((confirmed: boolean) => {
    setVisible(false);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(confirmed);
  }, []);

  const requestStrictAckIfNeeded = useCallback(async (eventId: number): Promise<boolean> => {
    const fetched = await fetchRefundPolicyForEvent(eventId);
    if (!fetched?.strictNoRefund) return true;
    setPolicy(fetched);
    setVisible(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const ackModalElement = (
    <StrictCancellationAckModal
      visible={visible}
      policy={policy}
      embedded={options?.embedded}
      onCancel={() => resolvePending(false)}
      onConfirm={() => resolvePending(true)}
    />
  );

  return { requestStrictAckIfNeeded, ackModalElement };
}
