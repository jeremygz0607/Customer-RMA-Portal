-- Operational RMA schema based on RMA_Troubleshooting_RMA_DevSpec_SOW_v1.md

CREATE TABLE dbo.RMA_Request (
    RMA_ID UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    Brand VARCHAR(20) NOT NULL,
    OrderID VARCHAR(50) NOT NULL,
    OrderItemID VARCHAR(50) NOT NULL,
    SKU VARCHAR(50) NOT NULL,
    SKUGroupName VARCHAR(100) NOT NULL,
    IsInternational BIT NOT NULL,
    WarrantyEligible BIT NOT NULL,
    WarrantyEndDate DATETIME NULL,
    WarrantyReasonCode VARCHAR(50) NULL,
    Status VARCHAR(50) NOT NULL,
    CustomerSelectedReturnMethod VARCHAR(20) NULL,
    CarrierPreference VARCHAR(30) NULL,
    BenchTestFeeAmount DECIMAL(10,2) NOT NULL CONSTRAINT DF_RMA_Request_BenchTestFee DEFAULT (39.99),
    AcceptedBenchFeeTerms BIT NOT NULL CONSTRAINT DF_RMA_Request_AcceptedBenchFeeTerms DEFAULT (0),
    AcceptedAt DATETIME NULL,
    AcceptedIP VARCHAR(45) NULL,
    AcceptedUserAgent NVARCHAR(400) NULL,
    HubSpotDealId VARCHAR(50) NULL,
    HubSpotTicketId VARCHAR(50) NULL,
    HubSpotContactId VARCHAR(50) NULL,
    CreatedAt DATETIME NOT NULL,
    UpdatedAt DATETIME NOT NULL
);

CREATE INDEX IX_RMA_OrderItemID ON dbo.RMA_Request (OrderItemID);
CREATE INDEX IX_RMA_OrderID ON dbo.RMA_Request (OrderID);
CREATE INDEX IX_RMA_Status_CreatedAt ON dbo.RMA_Request (Status, CreatedAt);

CREATE TABLE dbo.RMA_Troubleshooting (
    RMA_ID UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    SymptomsJson NVARCHAR(MAX) NULL,
    StepsCompletedJson NVARCHAR(MAX) NULL,
    EvidenceJson NVARCHAR(MAX) NULL,
    CustomerOptedOutOfTS BIT NOT NULL CONSTRAINT DF_RMA_Troubleshooting_OptedOut DEFAULT (0),
    AISummary NVARCHAR(MAX) NULL,
    AIRecommendation VARCHAR(20) NULL,
    AIConfidence DECIMAL(4,3) NULL,
    CONSTRAINT FK_RMA_Troubleshooting_RMA_Request FOREIGN KEY (RMA_ID) REFERENCES dbo.RMA_Request (RMA_ID)
);

CREATE TABLE dbo.RMA_Label (
    RMA_ID UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    EasyPostShipmentId VARCHAR(100) NULL,
    EasyPostRateId VARCHAR(100) NULL,
    Carrier VARCHAR(30) NULL,
    Service VARCHAR(50) NULL,
    TrackingNumber VARCHAR(50) NULL,
    BillingMode VARCHAR(30) NULL,
    LabelFilePath NVARCHAR(500) NULL,
    LabelCreatedAt DATETIME NULL,
    CONSTRAINT FK_RMA_Label_RMA_Request FOREIGN KEY (RMA_ID) REFERENCES dbo.RMA_Request (RMA_ID)
);

CREATE TABLE dbo.RMA_AuditLog (
    AuditId BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    RMA_ID UNIQUEIDENTIFIER NOT NULL,
    EventType VARCHAR(50) NOT NULL,
    ActorType VARCHAR(20) NOT NULL,
    PayloadJson NVARCHAR(MAX) NULL,
    CreatedAt DATETIME NOT NULL,
    CONSTRAINT FK_RMA_AuditLog_RMA_Request FOREIGN KEY (RMA_ID) REFERENCES dbo.RMA_Request (RMA_ID)
);

CREATE TABLE dbo.RMA_Playbook (
    SKUGroupName VARCHAR(100) NOT NULL PRIMARY KEY,
    PlaybookJson NVARCHAR(MAX) NOT NULL,
    Version INT NOT NULL,
    IsActive BIT NOT NULL,
    UpdatedAt DATETIME NOT NULL
);

