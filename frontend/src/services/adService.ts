class AdService {
  async showInterstitialAd(): Promise<boolean> {
    return false;
  }

  isInterstitialReady(): boolean {
    return false;
  }
}

export const adService = new AdService();