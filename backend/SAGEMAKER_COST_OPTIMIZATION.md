# SageMaker Cost Optimization Guide

## Current Setup

Your application uses the following SageMaker endpoints:
- **MedGemma Text** (`SAGEMAKER_MEDGEMMA_TEXT_ENDPOINT`) - Text generation
- **MedGemma Image** (`SAGEMAKER_MEDGEMMA_IMAGE_ENDPOINT`) - Vision/multimodal
- **MedASR** (`SAGEMAKER_MEDASR_ENDPOINT`) - Speech recognition
- **HEAR** (`SAGEMAKER_HEAR_ENDPOINT`) - Audio processing
- **MedSigLIP** (`SAGEMAKER_MEDSIGLIP_ENDPOINT`) - Vision-language

## How to Change Instance Types

### Step 1: Check Current Instance Types

1. Go to **AWS Console → SageMaker → Inference → Endpoints**
2. Click on each endpoint to see the current instance type
3. Note down the instance types (e.g., `ml.g5.2xlarge`, `ml.p3.2xlarge`)

### Step 2: Choose Cost-Effective Instance Types

**Recommended instance types (ordered by cost-effectiveness):**

#### For Text Models (MedGemma Text):
- **Current (likely)**: `ml.g5.2xlarge` (~$1.40/hour) or `ml.p3.2xlarge` (~$3.06/hour)
- **Recommended**: 
  - `ml.g5.xlarge` (~$0.70/hour) - **50% cheaper**, good for most workloads
  - `ml.g4dn.xlarge` (~$0.526/hour) - **62% cheaper**, if model fits
  - `ml.t3.xlarge` (~$0.20/hour) - **85% cheaper**, for light workloads (may be slower)

#### For Vision/Multimodal (MedGemma Image):
- **Current (likely)**: `ml.g5.2xlarge` or `ml.p3.2xlarge`
- **Recommended**:
  - `ml.g5.xlarge` (~$0.70/hour) - **50% cheaper**
  - `ml.g4dn.xlarge` (~$0.526/hour) - **62% cheaper**

#### For ASR (MedASR):
- **Current (likely)**: `ml.m5.xlarge` or `ml.c5.xlarge`
- **Recommended**:
  - `ml.t3.large` (~$0.10/hour) - **Very cheap**, sufficient for ASR
  - `ml.m5.large` (~$0.115/hour) - **Cheap**, good performance

### Step 3: Update Endpoint Configuration

**Option A: Via AWS Console (Easiest)**

1. Go to **SageMaker → Inference → Endpoint configurations**
2. Find your endpoint configuration (e.g., `medgemma-text-config`)
3. Click **Create endpoint configuration** (new version)
4. Select the new instance type
5. Save the new configuration
6. Go to **Endpoints** → Select your endpoint → **Update endpoint**
7. Choose the new configuration → **Update**

**Option B: Via AWS CLI**

```bash
# 1. Create new endpoint configuration
aws sagemaker create-endpoint-config \
  --endpoint-config-name medgemma-text-config-v2 \
  --production-variants VariantName=AllTraffic,ModelName=your-model-name,InstanceType=ml.g5.xlarge,InitialInstanceCount=1

# 2. Update endpoint
aws sagemaker update-endpoint \
  --endpoint-name your-endpoint-name \
  --endpoint-config-name medgemma-text-config-v2
```

**Option C: Via Python/Boto3 Script**

Create `update_endpoint_instance.py`:

```python
import boto3

sagemaker = boto3.client('sagemaker')

# Configuration
endpoint_name = 'your-endpoint-name'
new_instance_type = 'ml.g5.xlarge'  # Change this
model_name = 'your-model-name'  # Get from current endpoint config

# Get current endpoint config
endpoint = sagemaker.describe_endpoint(EndpointName=endpoint_name)
current_config = endpoint['EndpointConfigName']
config_details = sagemaker.describe_endpoint_config(EndpointConfigName=current_config)

# Create new config with smaller instance
new_config_name = f"{current_config}-v2"
sagemaker.create_endpoint_config(
    EndpointConfigName=new_config_name,
    ProductionVariants=[{
        'VariantName': 'AllTraffic',
        'ModelName': model_name,
        'InstanceType': new_instance_type,
        'InitialInstanceCount': 1
    }]
)

# Update endpoint
sagemaker.update_endpoint(
    EndpointName=endpoint_name,
    EndpointConfigName=new_config_name
)

print(f"Endpoint {endpoint_name} is updating to {new_instance_type}")
```

### Step 4: Monitor Performance

After changing instance types:

1. **Test response times** - Ensure they're acceptable
2. **Monitor CloudWatch metrics**:
   - `ModelLatency` - Should be < 5s for most requests
   - `Invocations` - Track usage
   - `CPUUtilization` - Should be < 80% average
   - `MemoryUtilization` - Should be < 80% average

3. **If performance degrades**:
   - Try the next size up (e.g., `ml.g5.xlarge` → `ml.g5.2xlarge`)
   - Or use **auto-scaling** to scale up during peak times

## Cost Savings Estimates

Assuming you're currently using `ml.g5.2xlarge` for all endpoints:

| Instance Type | Cost/Hour | Monthly (24/7) | Savings vs g5.2xlarge |
|--------------|-----------|----------------|----------------------|
| `ml.g5.2xlarge` (current) | $1.40 | ~$1,008 | Baseline |
| `ml.g5.xlarge` | $0.70 | ~$504 | **50%** |
| `ml.g4dn.xlarge` | $0.526 | ~$379 | **62%** |
| `ml.t3.xlarge` | $0.20 | ~$144 | **85%** |

**For 3 endpoints (Text, Image, ASR) running 24/7:**
- Current: ~$3,024/month
- With `ml.g5.xlarge`: ~$1,512/month (**$1,512 saved/month**)
- With `ml.g4dn.xlarge`: ~$1,137/month (**$1,887 saved/month**)

## Additional Cost Optimization Tips

### 1. Use Auto-Scaling (Scale to Zero)

Configure endpoints to scale down to 0 instances when not in use:

```python
sagemaker.register_scalable_target(
    ServiceNamespace='sagemaker',
    ResourceId=f'endpoint/{endpoint_name}/variant/AllTraffic',
    ScalableDimension='sagemaker:variant:DesiredInstanceCount',
    MinCapacity=0,  # Scale to zero
    MaxCapacity=2
)

sagemaker.put_scaling_policy(
    PolicyName='scale-down-policy',
    ServiceNamespace='sagemaker',
    ResourceId=f'endpoint/{endpoint_name}/variant/AllTraffic',
    ScalableDimension='sagemaker:variant:DesiredInstanceCount',
    PolicyType='TargetTrackingScaling',
    TargetTrackingScalingPolicyConfiguration={
        'TargetValue': 70.0,  # CPU utilization target
        'PredefinedMetricSpecification': {
            'PredefinedMetricType': 'SageMakerVariantInvocationsPerInstance'
        },
        'ScaleInCooldown': 300,  # 5 min before scaling in
        'ScaleOutCooldown': 60   # 1 min before scaling out
    }
)
```

### 2. Use Serverless Inference (Cheapest for Low Traffic)

For endpoints with sporadic usage, use **SageMaker Serverless Inference**:

- **Pay per request** instead of per hour
- **Auto-scales to zero** when idle
- **Cost**: ~$0.00004 per 1K tokens + $0.000004 per GB-second

**To enable:**
1. Create new endpoint config with `ServerlessConfig`
2. Set `MaxConcurrency` (e.g., 5)
3. Set `MemorySizeInMB` (e.g., 4096)

### 3. Use Spot Instances (For Development/Testing)

Use **SageMaker Managed Spot Training** for non-production:
- **Up to 90% cheaper** than on-demand
- Good for batch processing, not real-time endpoints

### 4. Switch to OpenAI (Consider)

If costs are still too high, consider switching to OpenAI:
- **GPT-4.1-mini**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **Pay per use** - no idle costs
- **May be cheaper** if usage is sporadic

To switch, just set environment variables:
```bash
AI_TEXT_PROVIDER=openai
AI_VISION_PROVIDER=openai
AI_ASR_PROVIDER=openai
OPENAI_API_KEY=your-key
```

## Quick Reference: Instance Type Comparison

| Instance | vCPU | RAM | GPU | Cost/Hour | Best For |
|----------|------|-----|-----|-----------|----------|
| `ml.t3.xlarge` | 4 | 16 GB | - | $0.20 | Light text workloads |
| `ml.m5.xlarge` | 4 | 16 GB | - | $0.23 | General purpose |
| `ml.g4dn.xlarge` | 4 | 16 GB | 1x T4 | $0.526 | Vision/GPU workloads |
| `ml.g5.xlarge` | 4 | 16 GB | 1x A10G | $0.70 | **Recommended** for most |
| `ml.g5.2xlarge` | 8 | 32 GB | 1x A10G | $1.40 | High performance |
| `ml.p3.2xlarge` | 8 | 61 GB | 1x V100 | $3.06 | Very high performance |

## Action Plan

1. ✅ **Check current instance types** in AWS Console
2. ✅ **Test smaller instance** (start with `ml.g5.xlarge`)
3. ✅ **Monitor performance** for 24-48 hours
4. ✅ **Enable auto-scaling** to scale to zero during idle
5. ✅ **Consider serverless** for low-traffic endpoints
6. ✅ **Compare costs** with OpenAI alternative

## Need Help?

If you need help with the actual endpoint update, I can:
- Create a Python script to automate the update
- Help set up auto-scaling
- Calculate exact cost savings based on your usage
