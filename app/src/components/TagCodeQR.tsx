// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  readonly value: string;
  readonly label: string;
};

/** Hold to reveal: a code on a bright screen is readable across a room. */
export const TagCodeQR = ({ value, label }: Props) => {
  const [image, setImage] = useState<string | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let live = true;
    void QRCode.toDataURL(value, { margin: 1, width: 280, errorCorrectionLevel: "M" }).then(
      (url) => {
        if (live) {
          setImage(url);
        }
      },
    );
    return () => {
      live = false;
    };
  }, [value]);

  useEffect(() => {
    if (!shown) {
      return;
    }
    const timer = window.setTimeout(() => setShown(false), 30_000);
    return () => window.clearTimeout(timer);
  }, [shown]);

  return (
    <div>
      {shown && image !== null ? (
        <>
          <div className="qr">
            <img src={image} alt={`Your one-time ${label}, as a QR code`} width={280} height={280} />
          </div>
          <p className="note" style={{ marginTop: 12 }}>
            Hides itself in 30 seconds. Anyone who photographs this still cannot use it: a tag also
            needs your hunter's own secret.
          </p>
        </>
      ) : (
        <button className="ghost" onClick={() => setShown(true)}>
          Show my code
        </button>
      )}
    </div>
  );
};
