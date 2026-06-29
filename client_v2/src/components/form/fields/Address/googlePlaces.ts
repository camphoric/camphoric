/**
 * Google Places (New) address autocomplete (SPEC §9.1, DR-23). Optional: only
 * used when a Google Maps API key is configured; with no key the Address field
 * falls back to plain inputs. Built on the non-deprecated `PlaceAutocompleteElement`.
 *
 * Note: this path requires a real API key to exercise, so it isn't covered by
 * the unit tests (which run the plain-input fallback).
 */

export interface ParsedAddress {
  street_address?: string;
  city?: string;
  state_or_province?: string;
  zip_code?: string;
  country?: string;
}

let scriptPromise: Promise<void> | null = null;

/** Inject the Google Maps JS API once; subsequent calls share the same promise. */
export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    if (typeof google !== 'undefined' && google.maps) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey,
    )}&libraries=places&v=weekly&loading=async`;
    script.async = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Failed to load Google Maps JS API')));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function parseAddressComponents(
  components: google.maps.places.AddressComponent[] | undefined,
): ParsedAddress {
  const byType: Record<string, string> = {};
  components?.forEach((component) => {
    const text = component.longText ?? '';
    component.types.forEach((type) => {
      byType[type] = text;
    });
  });
  const street = [byType.street_number, byType.route].filter(Boolean).join(' ');
  const zip = [byType.postal_code, byType.postal_code_suffix].filter(Boolean).join('-');
  return {
    street_address: street || undefined,
    city: byType.locality || undefined,
    state_or_province: byType.administrative_area_level_1 || undefined,
    zip_code: zip || undefined,
    country: byType.country || undefined,
  };
}

/**
 * Mount a Google `PlaceAutocompleteElement` inside `container`. On selection it
 * resolves the address components and calls `onSelect` with all sub-fields, so
 * the form can populate them atomically. Returns a cleanup function.
 */
export function mountPlaceAutocomplete(
  container: HTMLElement,
  apiKey: string,
  onSelect: (address: ParsedAddress) => void,
): () => void {
  let cancelled = false;
  let element: google.maps.places.PlaceAutocompleteElement | null = null;

  void loadGoogleMaps(apiKey)
    .then(async () => {
      if (cancelled) return;
      await google.maps.importLibrary('places');
      element = new google.maps.places.PlaceAutocompleteElement();
      // [Enter] should not submit the registration form while choosing an address.
      element.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') event.preventDefault();
      });
      element.addEventListener('gmp-select', (event) => {
        void (async () => {
          const place = event.placePrediction.toPlace();
          await place.fetchFields({ fields: ['addressComponents'] });
          onSelect(parseAddressComponents(place.addressComponents));
        })();
      });
      container.replaceChildren(element);
    })
    .catch((error: unknown) => {
      console.error('Google Places autocomplete failed to load', error);
    });

  return () => {
    cancelled = true;
    if (element && container.contains(element)) container.removeChild(element);
  };
}
