import { CfnOutput, Duration, Stack, StackProps } from "aws-cdk-lib";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import {
  CloudFrontAllowedCachedMethods,
  CloudFrontAllowedMethods,
  CloudFrontWebDistribution,
  OriginAccessIdentity,
  PriceClass,
  SecurityPolicyProtocol,
  ViewerCertificate,
  ViewerProtocolPolicy
} from "aws-cdk-lib/aws-cloudfront";
import { CnameRecord, HostedZone } from "aws-cdk-lib/aws-route53";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import {
  HOSTED_ZONE_ID,
  HOSTED_ZONE_NAME,
  PREFIX_NAME,
  RECORD_NAME,
} from "./constants";

interface FrontendStackProps extends StackProps {
  apiDomain: string;
  apiStage: string;
}

export class FrontendStack extends Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const hostedZone = HostedZone.fromHostedZoneAttributes(
      this,
      `${PREFIX_NAME}-hosted-zone`,
      {
        hostedZoneId: HOSTED_ZONE_ID,
        zoneName: HOSTED_ZONE_NAME,
      }
    );

    const acm = new Certificate(this, `${PREFIX_NAME}-acm`, {
      domainName: HOSTED_ZONE_NAME,
      subjectAlternativeNames: [`*.${HOSTED_ZONE_NAME}`],
      validation: CertificateValidation.fromDns(hostedZone),
    });

    const frontendSourceBucket = new Bucket(this, "FrontendAppBucket", {
      websiteIndexDocument: "index.html",
    });

    const frontendOriginAccessIdentity = new OriginAccessIdentity(
      this,
      "FrontendAppOIA",
      {
        comment: "Access from CloudFront to the bucket.",
      }
    );

    frontendSourceBucket.grantRead(frontendOriginAccessIdentity);

    const frontendCloudfront = new CloudFrontWebDistribution(
      this,
      "FrontendAppCloudFront",
      {
        comment: 'TO-do web application',
        originConfigs: [
          {
            s3OriginSource: {
              s3BucketSource: frontendSourceBucket,
              originAccessIdentity: frontendOriginAccessIdentity,
            },
            behaviors: [{ isDefaultBehavior: true }],
          },
          {
            customOriginSource: {
              domainName: props.apiDomain,
              originPath: `/${props.apiStage}`,
            },
            behaviors: [
              {
                pathPattern: "/api/*",
                allowedMethods: CloudFrontAllowedMethods.ALL,
                cachedMethods: CloudFrontAllowedCachedMethods.GET_HEAD_OPTIONS,
                defaultTtl: Duration.seconds(0),
                minTtl: Duration.seconds(0),
                maxTtl: Duration.seconds(0),
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                forwardedValues: {
                  queryString: true,
                  cookies: {
                    forward: "all",
                  },
                  headers: ["Authorization"],
                },
              },
            ],
          },
        ],
        errorConfigurations: [
          {
            errorCode: 404,
            errorCachingMinTtl: 0,
            responseCode: 200,
            responsePagePath: "/index.html",
          },
        ],
        priceClass: PriceClass.PRICE_CLASS_200,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        viewerCertificate: ViewerCertificate.fromAcmCertificate(acm, {
          aliases: [`${RECORD_NAME}.${HOSTED_ZONE_NAME}`],
          securityPolicy: SecurityPolicyProtocol.TLS_V1_2_2021,
        }),
      }
    );

    /**
     * Create CNAME for CDN Alternate domain names
     */
    new CnameRecord(this, `${PREFIX_NAME}-cname-alternative`, {
      ttl: Duration.minutes(1),
      recordName: RECORD_NAME,
      zone: hostedZone,
      domainName: frontendCloudfront.distributionDomainName,
    });

    new BucketDeployment(this, "FrontendAppDeploy", {
      sources: [Source.asset(`${__dirname}/build`)],
      destinationBucket: frontendSourceBucket,
      distribution: frontendCloudfront,
      distributionPaths: ["/*"],
    });

    new CfnOutput(this, "AppURL", {
      value: `https://${frontendCloudfront.distributionDomainName}/`,
    });
  }
}
