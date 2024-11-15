// lib/beehiiv.ts
export class BeehiivClient {
    private apiKey: string;
    private publicationId: string;
  
    constructor() {
      this.apiKey = process.env.BEEHIIV_API_KEY!;
      this.publicationId = process.env.BEEHIIV_PUBLICATION_ID!;
    }
  
    async getPosts(page = 1) {
      const response = await fetch(
        `https://api.beehiiv.com/v2/publications/${this.publicationId}/posts?page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );
      return response.json();
    }
  
    async subscribeUser(email: string, name: string) {
      // Implement subscription logic
    }
  
    async unsubscribeUser(subscriberId: string) {
      // Implement unsubscribe logic
    }
  
    async checkSubscription(email: string) {
      // Implement subscription check logic
    }
  }
  