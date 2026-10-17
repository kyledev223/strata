import { ButtonLink, Plate } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="frame grid justify-items-start gap-4 pt-16 pb-8">
      <Plate>404</Plate>
      <h1 className="type-h1">Nothing on this step</h1>
      <p className="max-w-[34rem] text-lead text-muted">That page or token doesn&rsquo;t exist, or it hasn&rsquo;t launched yet.</p>
      <div className="mt-2 flex flex-wrap gap-3">
        <ButtonLink href="/projects" variant="primary">
          See the projects
        </ButtonLink>
        <ButtonLink href="/" variant="secondary">
          Home
        </ButtonLink>
      </div>
    </div>
  );
}
