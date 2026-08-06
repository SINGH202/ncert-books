"use client";

import { useEffect, useRef } from "react";
import { trackEvent, type AnalyticsProps } from "@/lib/analytics";

type TrackEventOnMountProps = {
  name: string;
  props?: AnalyticsProps;
};

/** Fires a single analytics event when the component mounts. */
export function TrackEventOnMount({ name, props }: TrackEventOnMountProps) {
  const sent = useRef(false);
  const propsKey = JSON.stringify(props ?? {});

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    trackEvent(name, props);
    // propsKey captures prop identity without unstable object reference churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, propsKey]);

  return null;
}
