// app/api/search/route.test.ts
import 'openai/shims/node'
import { POST } from '@/app/api/search/route'
import { createClient } from '@/utils/supabase/server'
import { OpenAI } from 'openai'
import { Pinecone } from '@pinecone-database/pinecone'
import { NextResponse } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'

// Mock dependencies
jest.mock('@/utils/supabase/server')

class MockResponse {
  private responseData: any;
  public status: number;
  public headers: Headers;

  constructor(data: any, options: { status?: number; headers?: Headers } = {}) {
    this.responseData = data;
    this.status = options.status || 200;
    this.headers = options.headers || new Headers();
  }

  async json() {
    return this.responseData;
  }
}

// Update NextResponse mock
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn().mockImplementation((data, options = {}) => {
      return new MockResponse(data, {
        status: options.status || 200,
        headers: new Headers()
      });
    }),
  },
}));

// Mock Pinecone with inline implementation
jest.mock('@pinecone-database/pinecone', () => ({
  Pinecone: jest.fn().mockImplementation(() => ({
    index: jest.fn().mockReturnValue({
      query: jest.fn().mockResolvedValue({
        matches: [{
          id: '1',
          score: 0.8,
          metadata: {
            post_id: 1,
            title: 'Test Post',
            link: '/test',
            content: 'Test content'
          }
        }]
      })
    })
  }))
}));

// Mock OpenAI
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    embeddings: {
      create: jest.fn().mockResolvedValue({
        data: [{
          embedding: new Array(1536).fill(0)
        }]
      })
    },
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Test answer'
            }
          }]
        })
      }
    }
  }))
}));

// Helper functions to get mock instances
const getMockOpenAI = () => {
  const OpenAIMock = jest.mocked(OpenAI);
  const mockInstance = OpenAIMock.mock.results[0]?.value;
  return mockInstance as jest.Mocked<OpenAI>;
}

const getMockPineconeQuery = () => {
  const PineconeMock = jest.mocked(Pinecone);
  const mockInstance = PineconeMock.mock.results[0]?.value;
  const mockIndex = mockInstance?.index();
  return mockIndex?.query as jest.Mock;
}

describe('Search API Route', () => {
  let mockRequest: Request;
  let mockSupabaseClient: {
    auth: {
      getUser: jest.Mock
    },
    from: jest.Mock
  };

  const createRequest = (url: string, options: RequestInit = {}) => {
    return new Request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize a new Pinecone instance for each test
    new Pinecone();
    const mockQuery = getMockPineconeQuery();
    if (mockQuery) {
      mockQuery.mockResolvedValue({
        matches: [{
          id: '1',
          score: 0.8,
          metadata: {
            post_id: 1,
            title: 'Test Post',
            link: '/test',
            content: 'Test content'
          }
        }]
      });
    }

    // Mock Supabase client
    mockSupabaseClient = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: null
        })
      },
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      })
    };

    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('Request Validation', () => {
    it('should accept valid search queries', async () => {
      mockRequest = createRequest('http://localhost/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test query' })
      });

      const response = await POST(mockRequest);
      expect(response).toBeDefined();
      const data = await response.json();
      expect(data.results).toBeDefined();
      expect(data.answer).toBeDefined();
    });

    it('should return 400 when query is missing', async () => {
      mockRequest = createRequest('http://localhost/api/search', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(mockRequest);
      const data = await response.json();
      expect(data.error).toBe('Query is required');
      expect(response.status).toBe(400);
    });
  });

  describe('Authentication Handling', () => {
    it('should process requests from authenticated users', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { 
          user: { id: 'test-user-id' } 
        },
        error: null
      });

      mockRequest = createRequest('http://localhost/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test query' })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('search_history');
      expect(mockSupabaseClient.from('search_history').insert).toHaveBeenCalledWith({
        query: 'test query',
        user_id: 'test-user-id',
        total_results: 1,
        summary: 'Test answer'
      });
    });
  });

  describe('Search Processing', () => {
    it('should attempt relaxed search when strict search fails', async () => {
      const mockQuery = getMockPineconeQuery();
      if (mockQuery) {
        mockQuery
          .mockResolvedValueOnce({ matches: [] })
          .mockResolvedValueOnce({
            matches: [{
              id: '1',
              score: 0.65,
              metadata: {
                post_id: 1,
                title: 'Test Post',
                link: '/test',
                content: 'Test content'
              }
            }]
          });
      }

      mockRequest = createRequest('http://localhost/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test query' })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.results).toHaveLength(1);
      expect(data.results[0].similarity).toBeLessThan(0.75);
      expect(data.results[0].similarity).toBeGreaterThanOrEqual(0.6);
    });

    it('should handle Pinecone API errors gracefully', async () => {
      const mockQuery = getMockPineconeQuery();
      if (mockQuery) {
        mockQuery.mockImplementation(() => {
          throw new Error('Pinecone API Error');
        });
      }

      mockRequest = createRequest('http://localhost/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test query' })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(500);
      
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
      expect(data.details).toBe('Pinecone API Error');
    });
  });

  describe('Error Handling', () => {
    it('should handle OpenAI API errors gracefully', async () => {
      const mockOpenAI = getMockOpenAI();
      if (mockOpenAI) {
        (mockOpenAI.embeddings.create as jest.Mock).mockImplementation(() => {
          throw new Error('OpenAI API Error');
        });
      }

      mockRequest = createRequest('http://localhost/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test query' })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(500);
      
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
      expect(data.details).toBe('OpenAI API Error');
    });
  });
});