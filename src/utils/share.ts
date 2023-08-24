import { toaster } from "../toaster";

interface NativeShare {
  type: "nativeShare";
  allowDesktop?: boolean;
  title?: string;
}

interface Clipboard {
  type: "clipboard";
  toastMessage?: string;
}

interface Download {
  type: "download";
}

type ShareMethod = NativeShare | Clipboard | Download;

export async function shareImage(dataUrl: string, filename: string) {
  shareData(dataUrl, {
    filename,
    methods: [
      { type: "nativeShare" },
      { type: "clipboard", toastMessage: "Image copied to clipboard" },
      { type: "download" },
    ],
  });
}

export async function shareData(
  dataUri: string,
  opts: {
    filename: string;
    /** share options to try, in order of preference. attempts stop at first successful share event. */
    methods: Array<ShareMethod>;
  },
) {
  let blob: Blob | undefined;
  for (const method of opts.methods) {
    switch (method.type) {
      case "nativeShare":
        if (!blob) {
          blob = dataUriToBlob(dataUri);
        }
        const maybePromise = mobileShare(
          {
            title: method.title,
            files: [new File([blob], opts.filename, { type: blob.type })],
          },
          method.allowDesktop,
        );
        if (maybePromise) {
          return maybePromise;
        }
        break;

      case "clipboard":
        if (!blob) {
          blob = dataUriToBlob(dataUri);
        }
        try {
          await copyToClipboard(blob);
          toaster.show(
            {
              message: method.toastMessage,
              icon: "paperclip",
            },
            "copied-data",
          );
          return;
        } catch {
          break;
        }
      case "download":
        downloadDataUrl(dataUri, opts.filename);
        break;
    }
  }
}

/**
 * attempt to share using the mobile-oriented navigator.share api
 * will intentionally abort for non-mobile looking useragent strings
 * @returns promise of share event if initiated, or false if not attempted
 */
export function mobileShare(shareData: ShareData, allowDesktop = false) {
  const agent: string =
    navigator.userAgent || navigator.vendor || (window as any).opera;
  if (
    typeof navigator.share !== "undefined" &&
    typeof navigator.canShare === "function" &&
    (allowDesktop || isMobile(agent))
  ) {
    if (navigator.canShare(shareData)) {
      return navigator.share(shareData).catch();
    }
  }
  return false;
}

// seemingly originally from this weird site
// http://detectmobilebrowsers.com/
const regexA =
  /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i;
const regexB =
  /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i;
function isMobile(agent: string) {
  return regexA.test(agent) || regexB.test(agent.substr(0, 4));
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export function copyToClipboard(blob: Blob) {
  return navigator.clipboard.write([
    new ClipboardItem({
      [blob.type]: blob,
    }),
  ]);
}

function dataUriToBlob(dataUri: string) {
  const headerIndex = dataUri.indexOf(",");
  const header = dataUri.slice(0, headerIndex);
  const body = dataUri.slice(headerIndex + 1);
  const match = header.match(/data:(.+)(;base64)?$/);
  if (!match) {
    throw new Error("data uri is not well-formed");
  }
  const type = match[1] ?? undefined;
  const isBase64 = !!match[2];
  const decoded = isBase64 ? atob(body) : decodeURI(body);
  return new Blob([decoded], { type });
}
