import { parseBimJson, DataType, PartitionSourceType, RelationshipCardinality, CrossFilteringBehavior, TomParserError } from '../src/index.js';

describe('BIM Parser', () => {
  describe('parseBimJson', () => {
    it('should parse a minimal BIM JSON', () => {
      const bimJson = {
        model: {
          name: 'TestModel',
          compatibilityLevel: 1500,
          tables: [],
          relationships: []
        }
      };

      const result = parseBimJson(bimJson);

      expect(result.model.name).toBe('TestModel');
      expect(result.model.compatibilityLevel).toBe(1500);
      expect(result.tables).toEqual([]);
      expect(result.relationships).toEqual([]);
    });

    it('should parse tables with columns', () => {
      const bimJson = {
        model: {
          name: 'TestModel',
          compatibilityLevel: 1500,
          tables: [
            {
              name: 'Customer',
              columns: [
                { name: 'CustomerKey', dataType: 'Int64' },
                { name: 'CustomerName', dataType: 'String' }
              ]
            }
          ],
          relationships: []
        }
      };

      const result = parseBimJson(bimJson);

      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].name).toBe('Customer');
      expect(result.tables[0].columns).toHaveLength(2);
      expect(result.tables[0].columns[0].name).toBe('CustomerKey');
      expect(result.tables[0].columns[0].dataType).toBe(DataType.Int64);
    });

    it('should parse calculated columns with expressions', () => {
      const bimJson = {
        model: {
          name: 'TestModel',
          compatibilityLevel: 1500,
          tables: [
            {
              name: 'Sales',
              columns: [
                { name: 'Revenue', dataType: 'Decimal', expression: '[Amount] * [Price]' }
              ]
            }
          ],
          relationships: []
        }
      };

      const result = parseBimJson(bimJson);

      expect(result.tables[0].columns[0].expression).toBe('[Amount] * [Price]');
    });

    it('should parse partitions with query source', () => {
      const bimJson = {
        model: {
          name: 'TestModel',
          compatibilityLevel: 1500,
          tables: [
            {
              name: 'Sales',
              partitions: [
                {
                  name: 'SalesPartition',
                  source: {
                    type: 'query',
                    query: 'SELECT * FROM Sales'
                  }
                }
              ]
            }
          ],
          relationships: []
        }
      };

      const result = parseBimJson(bimJson);

      expect(result.tables[0].partitions).toHaveLength(1);
      expect(result.tables[0].partitions[0].name).toBe('SalesPartition');
      expect(result.tables[0].partitions[0].sourceType).toBe(PartitionSourceType.Query);
      expect(result.tables[0].partitions[0].query).toBe('SELECT * FROM Sales');
    });

    it('should parse partitions with M expression', () => {
      const bimJson = {
        model: {
          name: 'TestModel',
          compatibilityLevel: 1500,
          tables: [
            {
              name: 'Sales',
              partitions: [
                {
                  name: 'SalesPartition',
                  source: {
                    type: 'm',
                    expression: 'let Source = ...'
                  }
                }
              ]
            }
          ],
          relationships: []
        }
      };

      const result = parseBimJson(bimJson);

      expect(result.tables[0].partitions[0].sourceType).toBe(PartitionSourceType.M);
      expect(result.tables[0].partitions[0].expression).toBe('let Source = ...');
    });

    it('should parse measures', () => {
      const bimJson = {
        model: {
          name: 'TestModel',
          compatibilityLevel: 1500,
          tables: [
            {
              name: 'Sales',
              measures: [
                {
                  name: 'Total Sales',
                  expression: 'SUM(Sales[Amount])',
                  formatString: '$#,##0.00'
                }
              ]
            }
          ],
          relationships: []
        }
      };

      const result = parseBimJson(bimJson);

      expect(result.tables[0].measures).toHaveLength(1);
      expect(result.tables[0].measures[0].name).toBe('Total Sales');
      expect(result.tables[0].measures[0].expression).toBe('SUM(Sales[Amount])');
      expect(result.tables[0].measures[0].formatString).toBe('$#,##0.00');
    });

    it('should parse relationships', () => {
      const bimJson = {
        model: {
          name: 'TestModel',
          compatibilityLevel: 1500,
          tables: [
            { name: 'Customer', columns: [{ name: 'CustomerKey', dataType: 'Int64' }] },
            { name: 'Sales', columns: [{ name: 'CustomerKey', dataType: 'Int64' }] }
          ],
          relationships: [
            {
              name: 'CustomerSales',
              fromTable: 'Customer',
              fromColumn: 'CustomerKey',
              toTable: 'Sales',
              toColumn: 'CustomerKey',
              crossFilterDirection: 'OneDirection',
              fromCardinality: '1',
              toCardinality: '*',
              isActive: true
            }
          ]
        }
      };

      const result = parseBimJson(bimJson);

      expect(result.relationships).toHaveLength(1);
      expect(result.relationships[0].fromTable).toBe('Customer');
      expect(result.relationships[0].toTable).toBe('Sales');
      expect(result.relationships[0].cardinality).toBe(RelationshipCardinality.OneToMany);
      expect(result.relationships[0].crossFilteringBehavior).toBe(CrossFilteringBehavior.OneDirection);
      expect(result.relationships[0].isActive).toBe(true);
    });

    it('should throw error for missing model property', () => {
      const bimJson = {
        tables: []
      };

      expect(() => parseBimJson(bimJson)).toThrow(TomParserError);
      expect(() => parseBimJson(bimJson)).toThrow('missing required "model" property');
    });

    it('should handle missing optional fields gracefully', () => {
      const bimJson = {
        model: {
          name: 'TestModel',
          compatibilityLevel: 1500
        }
      };

      const result = parseBimJson(bimJson);

      expect(result.tables).toEqual([]);
      expect(result.relationships).toEqual([]);
      expect(result.model.cultures).toEqual([]);
    });

    it('should respect includeHiddenObjects option', () => {
      const bimJson = {
        model: {
          name: 'TestModel',
          compatibilityLevel: 1500,
          tables: [
            {
              name: 'Customer',
              isHidden: true,
              columns: [
                { name: 'Key', dataType: 'Int64', isHidden: true }
              ]
            }
          ]
        }
      };

      const withHidden = parseBimJson(bimJson, { includeHiddenObjects: true });
      expect(withHidden.tables[0].isHidden).toBe(true);
      expect(withHidden.tables[0].columns[0].isHidden).toBe(true);

      const withoutHidden = parseBimJson(bimJson, { includeHiddenObjects: false });
      expect(withoutHidden.tables).toHaveLength(0);
    });
  });

  describe('DataType mapping', () => {
    it('should map all known data types', () => {
      const bimJson = {
        model: {
          name: 'TestModel',
          compatibilityLevel: 1500,
          tables: [
            {
              name: 'Test',
              columns: [
                { name: 'intCol', dataType: 'Int64' },
                { name: 'doubleCol', dataType: 'Double' },
                { name: 'boolCol', dataType: 'Boolean' },
                { name: 'stringCol', dataType: 'String' },
                { name: 'dateCol', dataType: 'DateTime' },
                { name: 'decimalCol', dataType: 'Decimal' }
              ]
            }
          ],
          relationships: []
        }
      };

      const result = parseBimJson(bimJson);
      const columns = result.tables[0].columns;

      expect(columns.find(c => c.name === 'intCol')?.dataType).toBe(DataType.Int64);
      expect(columns.find(c => c.name === 'doubleCol')?.dataType).toBe(DataType.Double);
      expect(columns.find(c => c.name === 'boolCol')?.dataType).toBe(DataType.Boolean);
      expect(columns.find(c => c.name === 'stringCol')?.dataType).toBe(DataType.String);
      expect(columns.find(c => c.name === 'dateCol')?.dataType).toBe(DataType.DateTime);
      expect(columns.find(c => c.name === 'decimalCol')?.dataType).toBe(DataType.Decimal);
    });

    it('should return Unknown for unknown data types', () => {
      const bimJson = {
        model: {
          name: 'TestModel',
          compatibilityLevel: 1500,
          tables: [
            {
              name: 'Test',
              columns: [{ name: 'col', dataType: 'UnknownType' }]
            }
          ],
          relationships: []
        }
      };

      const result = parseBimJson(bimJson);
      expect(result.tables[0].columns[0].dataType).toBe(DataType.Unknown);
    });
  });
});