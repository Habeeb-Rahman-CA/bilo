import { Directive, ElementRef, Input, OnInit, OnDestroy, OnChanges, SimpleChanges, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const TRANSPARENT_PIXEL = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';

@Directive({
  selector: 'img[appLazyImage]',
  standalone: true
})
export class LazyImageDirective implements OnInit, OnDestroy, OnChanges {
  @Input() appLazyImage!: string;
  @Input() fallbackSrc?: string;

  private observer?: IntersectionObserver;
  private isLoaded = false;

  constructor(
    private el: ElementRef<HTMLImageElement>,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    const img = this.el.nativeElement;
    img.loading = 'lazy';
    img.classList.add('lazy-image-init');

    if (isPlatformBrowser(this.platformId) && typeof IntersectionObserver !== 'undefined') {
      // Set initial transparent placeholder
      if (!img.src || img.src === window.location.href) {
        img.src = TRANSPARENT_PIXEL;
      }

      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.loadImage();
              this.observer?.disconnect();
            }
          });
        },
        {
          rootMargin: '100px 0px',
          threshold: 0.01
        }
      );

      this.observer.observe(img);
    } else {
      // Direct load for non-browser or environments without IntersectionObserver
      this.loadImage();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['appLazyImage'] && !changes['appLazyImage'].isFirstChange()) {
      if (this.isLoaded || !this.observer) {
        this.loadImage();
      }
    }
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private loadImage(): void {
    const img = this.el.nativeElement;
    if (!this.appLazyImage) return;

    img.classList.add('lazy-loading');
    img.src = this.appLazyImage;
  }

  @HostListener('load')
  onLoad(): void {
    const img = this.el.nativeElement;
    if (img.src && img.src !== TRANSPARENT_PIXEL) {
      this.isLoaded = true;
      img.classList.remove('lazy-loading');
      img.classList.add('lazy-loaded');
    }
  }

  @HostListener('error')
  onError(): void {
    const img = this.el.nativeElement;
    img.classList.remove('lazy-loading');
    img.classList.add('lazy-error');

    if (this.fallbackSrc && img.src !== this.fallbackSrc) {
      img.src = this.fallbackSrc;
    }
  }
}
