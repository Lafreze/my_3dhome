'use client';
import ModelLibrary from '../model-library';
import { StudioProvider } from '../studio-settings';
export default function ModelsPage() {
  return (
    <StudioProvider>
      <ModelLibrary />
    </StudioProvider>
  );
}
