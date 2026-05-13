import { Link, useNavigate } from "react-router";
import type { FnKind } from "@effing/fn";
import type { Resolution } from "../resolutions.server";
import { Select } from "./Select";

export type HeaderCurrent = {
  kind: FnKind;
  id: string;
  width: number;
  height: number;
  resolutions: Resolution[];
};

function kindLabel(kind: FnKind): string {
  return kind[0].toUpperCase() + kind.slice(1);
}

export function Header({
  projectName,
  current,
}: {
  projectName: string;
  current?: HeaderCurrent;
}) {
  const navigate = useNavigate();

  const separator = (
    <span
      aria-hidden="true"
      style={{
        color: "var(--color-coal-light-3)",
        fontWeight: 400,
        fontSize: "1rem",
        userSelect: "none",
      }}
    >
      /
    </span>
  );

  const projectStyle = {
    fontSize: "0.95rem",
    fontWeight: 700,
    color: "var(--color-coal)",
    letterSpacing: "-0.01em",
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        height: "var(--header-h)",
        borderBottom: "1px solid var(--color-coal-light-5)",
        backgroundColor:
          "color-mix(in srgb, var(--color-snow) 82%, transparent)",
        backdropFilter: "saturate(180%) blur(10px)",
        WebkitBackdropFilter: "saturate(180%) blur(10px)",
      }}
    >
      <div
        style={{
          height: "100%",
          padding: "0 2rem",
          display: "flex",
          alignItems: "center",
          gap: "0.65rem",
        }}
      >
      <Link
        to="/"
        aria-label="Effing overview"
        style={{
          display: "inline-flex",
          alignItems: "center",
          height: "100%",
          textDecoration: "none",
          flexShrink: 0,
        }}
      >
        <EffingLogo />
      </Link>
      {projectName && (
        <>
          {separator}
          <Link
            to="/preview"
            className="header-link"
            aria-label={`${projectName} overview`}
            style={{ ...projectStyle, flexShrink: 0 }}
          >
            {projectName}
          </Link>
        </>
      )}
      {current && (
        <>
          {separator}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              minWidth: 0,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                fontSize: "0.6rem",
                fontWeight: 700,
                lineHeight: 1,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--color-salad-dark-1)",
                backgroundColor: "var(--color-salad-light-5)",
                padding: "0.26rem 0.5rem 0.22rem",
                borderRadius: 999,
                flexShrink: 0,
              }}
            >
              {kindLabel(current.kind)}
            </span>
            <span
              title={current.id}
              style={{
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "var(--color-coal)",
                letterSpacing: "-0.01em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              {current.id}
            </span>
          </div>
          {separator}
          <ResolutionPicker
            width={current.width}
            height={current.height}
            resolutions={current.resolutions}
            onPick={(w, h) =>
              navigate(
                `/preview/${current.kind}/${current.id}?w=${w}&h=${h}`,
              )
            }
          />
        </>
      )}
      </div>
    </header>
  );
}

function ResolutionPicker({
  width,
  height,
  resolutions,
  onPick,
}: {
  width: number;
  height: number;
  resolutions: Resolution[];
  onPick: (w: number, h: number) => void;
}) {
  return (
    <Select
      value={`${width}x${height}`}
      ariaLabel="Resolution"
      onChange={(v) => {
        const [w, h] = v.split("x").map(Number);
        onPick(w, h);
      }}
    >
      {resolutions.map((r) => (
        <option
          key={`${r.width}x${r.height}`}
          value={`${r.width}x${r.height}`}
        >
          {r.label} · {r.width}×{r.height}
        </option>
      ))}
    </Select>
  );
}

function EffingLogo() {
  return (
    <svg
      width="76"
      height="24"
      viewBox="0 0 126 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path
        opacity="0.5"
        d="M30.8727 32.8704V30.6013H32.9382C33.3843 30.6013 33.7043 30.4947 33.8982 30.2813C34.0921 30.068 34.1891 29.748 34.1891 29.3214V23.1541C34.1891 22.5529 34.3055 22.0098 34.5382 21.525C34.7903 21.0401 35.12 20.662 35.5273 20.3904C35.954 20.0995 36.4097 19.9541 36.8946 19.9541V20.0704C36.4097 20.0704 35.954 19.925 35.5273 19.6341C35.12 19.3432 34.7903 18.9553 34.5382 18.4704C34.3055 17.9662 34.1891 17.4232 34.1891 16.8413V10.6741C34.1891 10.228 34.0921 9.90802 33.8982 9.71408C33.7043 9.50074 33.3843 9.39408 32.9382 9.39408H30.8727V7.12498H33.9273C34.9746 7.12498 35.7697 7.4062 36.3127 7.96862C36.8558 8.53105 37.1273 9.3262 37.1273 10.3541V16.5213C37.1273 17.2971 37.2727 17.8692 37.5637 18.2377C37.874 18.5868 38.3879 18.7807 39.1055 18.8195L40.0073 18.9068V21.0886L39.1055 21.1468C38.3879 21.205 37.874 21.4086 37.5637 21.7577C37.2727 22.1068 37.1273 22.6789 37.1273 23.4741V29.6413C37.1273 30.6692 36.8558 31.4644 36.3127 32.0268C35.7697 32.5892 34.9746 32.8704 33.9273 32.8704H30.8727Z"
        fill="var(--color-salad)"
      />
      <path
        d="M22.7622 13.0887V27.6341H9.69696V13.0887H22.7622ZM30.0349 27.6341L23.9743 23.4675V17.2932L30.0349 13.0887V27.6341Z"
        fill="var(--color-salad)"
      />
      <path
        opacity="0.5"
        d="M6.05091 32.8705C5.04242 32.8705 4.25697 32.5892 3.69455 32.0268C3.15152 31.4838 2.88 30.6886 2.88 29.6414V23.4741C2.88 22.6789 2.72485 22.1068 2.41455 21.7577C2.12364 21.4086 1.61939 21.205 0.901818 21.1468L0 21.0886V18.9068L0.901818 18.8195C1.61939 18.7808 2.12364 18.5868 2.41455 18.2377C2.72485 17.8692 2.88 17.2971 2.88 16.5214V10.3541C2.88 9.30682 3.15152 8.51167 3.69455 7.96864C4.25697 7.40621 5.04242 7.125 6.05091 7.125H9.13455V9.39409H7.06909C6.64242 9.39409 6.32242 9.50076 6.10909 9.71409C5.91515 9.90803 5.81818 10.228 5.81818 10.6741V16.8414C5.81818 17.4232 5.69212 17.9662 5.44 18.4705C5.20727 18.9553 4.88727 19.3432 4.48 19.6341C4.07273 19.925 3.61697 20.0705 3.11273 20.0705V19.9541C3.61697 19.9541 4.07273 20.0995 4.48 20.3905C4.88727 20.662 5.20727 21.0402 5.44 21.525C5.69212 22.0098 5.81818 22.5529 5.81818 23.1541V29.3214C5.81818 29.748 5.91515 30.068 6.10909 30.2814C6.32242 30.4947 6.64242 30.6014 7.06909 30.6014H9.13455V32.8705H6.05091Z"
        fill="var(--color-salad)"
      />
      <path
        d="M117.994 33.59C116.634 33.59 115.354 33.43 114.154 33.11C112.974 32.81 111.934 32.34 111.034 31.7L112.114 29.09C112.674 29.45 113.264 29.75 113.884 29.99C114.504 30.25 115.134 30.44 115.774 30.56C116.414 30.68 117.054 30.74 117.694 30.74C119.034 30.74 120.034 30.41 120.694 29.75C121.374 29.11 121.714 28.15 121.714 26.87V24.17H121.984C121.684 25.19 121.054 26.01 120.094 26.63C119.154 27.23 118.084 27.53 116.884 27.53C115.564 27.53 114.414 27.23 113.434 26.63C112.454 26.01 111.694 25.15 111.154 24.05C110.614 22.95 110.344 21.67 110.344 20.21C110.344 18.75 110.614 17.48 111.154 16.4C111.694 15.3 112.454 14.45 113.434 13.85C114.414 13.23 115.564 12.92 116.884 12.92C118.124 12.92 119.204 13.23 120.124 13.85C121.064 14.45 121.674 15.25 121.954 16.25H121.714V13.22H125.374V26.42C125.374 28 125.094 29.32 124.534 30.38C123.974 31.46 123.144 32.26 122.044 32.78C120.944 33.32 119.594 33.59 117.994 33.59ZM117.904 24.68C119.064 24.68 119.984 24.28 120.664 23.48C121.344 22.68 121.684 21.59 121.684 20.21C121.684 18.83 121.344 17.75 120.664 16.97C119.984 16.17 119.064 15.77 117.904 15.77C116.744 15.77 115.824 16.17 115.144 16.97C114.464 17.75 114.124 18.83 114.124 20.21C114.124 21.59 114.464 22.68 115.144 23.48C115.824 24.28 116.744 24.68 117.904 24.68Z"
        fill="var(--color-coal)"
      />
      <path
        d="M93.6049 27.89V13.22H97.2649V16.16H96.9349C97.3749 15.1 98.0549 14.3 98.9749 13.76C99.9149 13.2 100.975 12.92 102.155 12.92C103.335 12.92 104.305 13.14 105.065 13.58C105.825 14.02 106.395 14.69 106.775 15.59C107.155 16.47 107.345 17.59 107.345 18.95V27.89H103.595V19.13C103.595 18.37 103.495 17.75 103.295 17.27C103.115 16.79 102.825 16.44 102.425 16.22C102.045 15.98 101.555 15.86 100.955 15.86C100.235 15.86 99.6049 16.02 99.0649 16.34C98.5249 16.64 98.1049 17.08 97.8049 17.66C97.5049 18.22 97.3549 18.88 97.3549 19.64V27.89H93.6049Z"
        fill="var(--color-coal)"
      />
      <path
        d="M76.2551 27.89V16.04H73.4351V13.22H77.3351L76.2551 14.21V13.19C76.2551 11.11 76.7951 9.54 77.8751 8.48C78.9751 7.42 80.6751 6.82 82.9751 6.68L84.2951 6.62L84.4751 9.38L83.3051 9.44C82.5051 9.48 81.8651 9.63 81.3851 9.89C80.9051 10.13 80.5551 10.47 80.3351 10.91C80.1151 11.35 80.0051 11.91 80.0051 12.59V13.58V13.22H89.6951V27.89H85.9451V16.04H80.0051V27.89H76.2551ZM85.7351 10.07V6.41H89.9051V10.07H85.7351Z"
        fill="var(--color-coal)"
      />
      <path
        d="M66.0012 27.89V16.04H63.1812V13.22H67.0812L66.0012 14.21V13.19C66.0012 11.11 66.5412 9.54 67.6212 8.48C68.7212 7.42 70.4212 6.82 72.7212 6.68L74.1912 6.59L74.4312 9.35L73.0512 9.44C72.2512 9.48 71.6112 9.63 71.1312 9.89C70.6512 10.13 70.3012 10.47 70.0812 10.91C69.8612 11.35 69.7512 11.91 69.7512 12.59V13.7L69.2712 13.22H73.7412V16.04H69.7512V27.89H66.0012Z"
        fill="var(--color-coal)"
      />
      <path
        d="M56.04 28.19C54.38 28.19 52.95 27.88 51.75 27.26C50.55 26.64 49.62 25.76 48.96 24.62C48.32 23.48 48 22.13 48 20.57C48 19.05 48.31 17.72 48.93 16.58C49.57 15.44 50.44 14.55 51.54 13.91C52.66 13.25 53.93 12.92 55.35 12.92C56.75 12.92 57.95 13.22 58.95 13.82C59.95 14.42 60.72 15.27 61.26 16.37C61.82 17.47 62.1 18.78 62.1 20.3V21.41H51.03V19.25H59.46L58.98 19.7C58.98 18.34 58.68 17.3 58.08 16.58C57.48 15.84 56.62 15.47 55.5 15.47C54.66 15.47 53.94 15.67 53.34 16.07C52.76 16.45 52.31 17 51.99 17.72C51.69 18.42 51.54 19.26 51.54 20.24V20.45C51.54 21.55 51.71 22.46 52.05 23.18C52.39 23.9 52.9 24.44 53.58 24.8C54.26 25.16 55.1 25.34 56.1 25.34C56.92 25.34 57.74 25.22 58.56 24.98C59.38 24.72 60.13 24.32 60.81 23.78L61.86 26.3C61.16 26.88 60.28 27.34 59.22 27.68C58.16 28.02 57.1 28.19 56.04 28.19Z"
        fill="var(--color-coal)"
      />
    </svg>
  );
}
