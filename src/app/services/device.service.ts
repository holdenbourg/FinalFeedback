import { Injectable, signal } from '@angular/core';
import { fromEvent } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type Orientation = 'portrait' | 'landscape';

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  // ✅ Initialize with default values first
  public deviceType = signal<DeviceType>('desktop');
  public orientation = signal<Orientation>('portrait');
  public isTouchDevice = signal<boolean>(false);
  public screenWidth = signal<number>(1920);
  public screenHeight = signal<number>(1080);

  // Breakpoints (matching CSS)
  private readonly breakpoints = {
    mobile: 480,
    mobileLandscape: 767,
    tablet: 1024,
    tabletLandscape: 1199,
    desktop: 1200,
    largeDesktop: 1440
  };

  constructor() {
    // ✅ Update state after signals are initialized
    this.updateDeviceState();

    // Listen for window resize
    fromEvent(window, 'resize')
      .pipe(debounceTime(150))
      .subscribe(() => this.updateDeviceState());

    // Listen for orientation change
    fromEvent(window, 'orientationchange')
      .subscribe(() => this.updateDeviceState());
  }

  private updateDeviceState() {
    this.deviceType.set(this.detectDeviceType());
    this.orientation.set(this.detectOrientation());
    this.isTouchDevice.set(this.detectTouch());
    this.screenWidth.set(window.innerWidth);
    this.screenHeight.set(window.innerHeight);
  }

  private detectDeviceType(): DeviceType {
    const width = window.innerWidth;

    if (width < this.breakpoints.mobileLandscape) {
      return 'mobile';
    } else if (width < this.breakpoints.desktop) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  private detectOrientation(): Orientation {
    return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
  }

  private detectTouch(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  // Helper methods
  isMobile(): boolean {
    return this.deviceType() === 'mobile';
  }

  isTablet(): boolean {
    return this.deviceType() === 'tablet';
  }

  isDesktop(): boolean {
    return this.deviceType() === 'desktop';
  }

  isPortrait(): boolean {
    return this.orientation() === 'portrait';
  }

  isLandscape(): boolean {
    return this.orientation() === 'landscape';
  }

  // Get optimal grid columns based on device
  getOptimalColumns(): number {
    const width = this.screenWidth();
    
    if (width < this.breakpoints.mobile) return 1;
    if (width < this.breakpoints.mobileLandscape) return 2;
    if (width < this.breakpoints.tablet) return 3;
    if (width < this.breakpoints.desktop) return 4;
    if (width < this.breakpoints.largeDesktop) return 5;
    return 6;
  }

  // Get optimal font size multiplier
  getFontSizeMultiplier(): number {
    const width = this.screenWidth();
    
    if (width < this.breakpoints.mobileLandscape) return 0.875;
    if (width < this.breakpoints.desktop) return 1;
    return 1.125;
  }

  // Check if viewport is at least a certain size
  isAtLeast(breakpoint: keyof typeof this.breakpoints): boolean {
    return this.screenWidth() >= this.breakpoints[breakpoint];
  }

  // Get device info for debugging
  getDeviceInfo() {
    return {
      type: this.deviceType(),
      orientation: this.orientation(),
      isTouch: this.isTouchDevice(),
      width: this.screenWidth(),
      height: this.screenHeight(),
      optimalColumns: this.getOptimalColumns()
    };
  }
}